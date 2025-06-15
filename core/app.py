import os, time
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from models import Base, ShellyStatus, User, RoleEnum
from security import hash_password, verify_password, create_access_token, decode_access_token

# --- DB-Setup ---
DATABASE_URL = os.getenv('DATABASE_URL')
engine       = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# --- FastAPI & CORS ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET","POST","DELETE","OPTIONS"],
    allow_headers=["*"],
)

# --- OAuth2 ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

@app.on_event("startup")
def on_startup():
    # 1) Tabellen anlegen (Retry)
    for _ in range(10):
        try:
            Base.metadata.create_all(bind=engine)
            break
        except OperationalError:
            time.sleep(2)
    else:
        raise RuntimeError("Could not connect to database")

    # 2) Default-Admin anlegen, falls keine Users existieren
    admin_user = os.getenv("ADMIN_USER")
    admin_pass = os.getenv("ADMIN_PASS")
    if admin_user and admin_pass:
        db = SessionLocal()
        if db.query(User).count() == 0:
            new = User(
                username        = admin_user,
                hashed_password = hash_password(admin_pass),
                role            = RoleEnum.admin
            )
            db.add(new)
            db.commit()
            print(f"[startup] Default admin '{admin_user}' angelegt.")
        db.close()

# --- Pydantic-Modelle ---
class ShellyIn(BaseModel):
    sensor: dict
    tmp:    dict
    bat:    dict

class UserCreate(BaseModel):
    username: str
    password: str
    role:     RoleEnum

# --- Helper: aktuellen User aus Token holen ---
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload  = decode_access_token(token)
        username = payload.get("sub")
        role     = payload.get("role")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    db   = SessionLocal()
    user = db.query(User).filter(User.username==username).first()
    if not user or user.role.value!=role:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user

# --- Auth-Endpoints ---
@app.post("/api/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db   = SessionLocal()
    user = db.query(User).filter(User.username==form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    token = create_access_token({"sub": user.username, "role": user.role.value})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/api/users")
def create_user(u: UserCreate, current: User = Depends(get_current_user)):
    if current.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    db = SessionLocal()
    new = User(username=u.username, hashed_password=hash_password(u.password), role=u.role)
    db.add(new); db.commit(); db.refresh(new)
    return {"id": new.id, "username": new.username, "role": new.role}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, current: User = Depends(get_current_user)):
    if current.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    db   = SessionLocal()
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user); db.commit()
    return {"detail": "deleted"}

# --- Dashboard & Logs ---
@app.get("/api/door-status/latest")
def latest_status(current: User = Depends(get_current_user)):
    db  = SessionLocal()
    obj = db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="No data")
    age = datetime.utcnow() - obj.timestamp
    return {
        "timestamp": obj.timestamp,
        "state":     obj.state,
        "temp":      obj.temp,
        "battery":   obj.battery,
        "offline":   age > timedelta(seconds=30)
    }

@app.get("/api/door-status/history")
def history(current: User = Depends(get_current_user)):
    if current.role not in (RoleEnum.auditor, RoleEnum.admin):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    db = SessionLocal()
    return db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).limit(100).all()

# --- Agent-Endpoint für Datenaufnahme ---
@app.post("/api/shelly", status_code=201)
def receive_shelly(data: ShellyIn):
    db  = SessionLocal()
    obj = ShellyStatus(state=data.sensor["state"], temp=data.tmp["value"], battery=data.bat["value"])
    db.add(obj)
    db.commit()
    return {"id": obj.id}
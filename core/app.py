import os, time
from datetime import datetime, timedelta
from typing import List

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from models import Base, ShellyStatus, User, RoleEnum
from security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)

# DB
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# FastAPI + CORS
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

@app.on_event("startup")
def on_startup():
    for _ in range(10):
        try:
            Base.metadata.create_all(bind=engine)
            break
        except OperationalError:
            time.sleep(2)
    else:
        raise RuntimeError("DB connect failed")
    admin_user = os.getenv("ADMIN_USER")
    admin_pass = os.getenv("ADMIN_PASS")
    if admin_user and admin_pass:
        db = SessionLocal()
        if db.query(User).count() == 0:
            db.add(User(
                username=admin_user,
                hashed_password=hash_password(admin_pass),
                role=RoleEnum.admin
            ))
            db.commit()
        db.close()

# Pydantic
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: RoleEnum

class UserOut(BaseModel):
    id:       int
    username: str
    role:     str

class UserMe(BaseModel):
    username: str
    role:     str

class ShellyIn(BaseModel):
    sensor: dict
    tmp:    dict
    bat:    dict

# Auth helper
def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload  = decode_token(token)
        username = payload.get("sub")
        role     = payload.get("role")
    except:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    db = SessionLocal()
    user = db.query(User).filter(User.username==username).first()
    db.close()
    if not user or user.role.value != role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user

# --- Auth Endpoints ---

@app.post("/api/token", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db   = SessionLocal()
    user = db.query(User).filter(User.username==form_data.username).first()
    db.close()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wrong username or password")
    access  = create_access_token({"sub": user.username, "role": user.role.value})
    refresh = create_refresh_token({"sub": user.username, "role": user.role.value})
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}

@app.post("/api/token/refresh", response_model=dict)
def refresh_token(req: RefreshRequest):
    try:
        payload  = decode_token(req.refresh_token)
        username = payload["sub"]
        role     = payload["role"]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    new_access = create_access_token({"sub": username, "role": role})
    return {"access_token": new_access, "token_type": "bearer"}

# --- User Endpoints ---

@app.post("/api/users", response_model=UserOut)
def create_user(u: UserCreate, current: User = Depends(get_current_user)):
    if current.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    db = SessionLocal()
    new = User(username=u.username, hashed_password=hash_password(u.password), role=u.role)
    db.add(new); db.commit(); db.refresh(new)
    out = {"id": new.id, "username": new.username, "role": new.role.value}
    db.close()
    return out

@app.get("/api/users", response_model=List[UserOut])
def list_users(current: User = Depends(get_current_user)):
    if current.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    db = SessionLocal()
    qs = db.query(User).all()
    out = [{"id": u.id, "username": u.username, "role": u.role.value} for u in qs]
    db.close()
    return out

@app.get("/api/users/me", response_model=UserMe)
def read_me(current: User = Depends(get_current_user)):
    return {"username": current.username, "role": current.role.value}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, current: User = Depends(get_current_user)):
    if current.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    db   = SessionLocal()
    user = db.query(User).get(user_id)
    if not user:
        db.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(user); db.commit(); db.close()
    return {"detail":"deleted"}

# --- Dashboard & Logs ---

@app.get("/api/door-status/latest")
def latest_status(current: User = Depends(get_current_user)):
    db  = SessionLocal()
    obj = db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).first()
    db.close()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No data")
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    db   = SessionLocal()
    data = db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).limit(100).all()
    db.close()
    return data

@app.post("/api/shelly", status_code=201)
def receive_shelly(data: ShellyIn):
    db  = SessionLocal()
    obj = ShellyStatus(state=data.sensor["state"], temp=data.tmp["value"], battery=data.bat["value"])
    db.add(obj); db.commit(); db.close()
    return {"id": obj.id}
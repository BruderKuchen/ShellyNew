import os
from datetime import datetime, timedelta
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from core.models import Base, ShellyStatus, User, RoleEnum, UserCreate, UserRead, ShellyStatusRead
from core.database import SessionLocal, engine

# --------------------------------------------------
#  Environment & Security-Setup
# --------------------------------------------------

load_dotenv()  # liest dein .env

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# --------------------------------------------------
#  Database
# --------------------------------------------------

# Tabellenschema anlegen, falls nicht existiert
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --------------------------------------------------
#  Hilfsfunktionen
# --------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

# --------------------------------------------------
#  App und Startup-Event
# --------------------------------------------------

app = FastAPI(title="Shelly Core API")

@app.on_event("startup")
def ensure_admin_exists():
    db = next(get_db())
    admin = db.query(User).filter(User.username == os.getenv("ADMIN_USER")).first()
    if not admin:
        admin = User(
            username=os.getenv("ADMIN_USER"),
            hashed_password=hash_password(os.getenv("ADMIN_PASS")),
            role=RoleEnum.admin
        )
        db.add(admin)
        db.commit()
        print(f"[startup] Default admin '{admin.username}' angelegt.")

# --------------------------------------------------
#  Auth-Endpoints
# --------------------------------------------------

@app.post("/api/token", response_model=dict)
def login_for_token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token(
        data={"sub": user.username, "role": user.role.value}
    )
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=UserRead)
def read_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRead(username=user.username, role=user.role.value)

# --------------------------------------------------
#  User-Management (Admin-only)
# --------------------------------------------------

@app.post("/api/users", response_model=UserRead)
def create_user(new: UserCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if payload.get("role") != RoleEnum.admin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    user = User(
        username=new.username,
        hashed_password=hash_password(new.password),
        role=RoleEnum(new.role)
    )
    db.add(user)
    db.commit()
    return UserRead(username=user.username, role=user.role.value)

@app.get("/api/users", response_model=List[UserRead])
def list_users(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if payload.get("role") != RoleEnum.admin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    return [UserRead(username=u.username, role=u.role.value) for u in db.query(User).all()]

# --------------------------------------------------
#  Shelly-Status Endpoints (Beispiel)
# --------------------------------------------------

@app.post("/api/shelly", status_code=201)
def ingest_shelly(data: ShellyStatusRead, db: Session = Depends(get_db)):
    obj = ShellyStatus(**data.dict())
    db.add(obj)
    db.commit()
    return {"status": "created"}

@app.get("/api/door-status/latest", response_model=ShellyStatusRead)
def get_latest_status(db: Session = Depends(get_db)):
    entry = db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).first()
    return entry or {}

@app.get("/api/door-status/history", response_model=List[ShellyStatusRead])
def get_status_history(db: Session = Depends(get_db)):
    return db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).limit(50).all()
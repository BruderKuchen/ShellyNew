# core/app.py
import os
from datetime import datetime, timedelta
from enum import Enum
from typing import List

from fastapi import (
    FastAPI, Depends, HTTPException, status, Request
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Enum as SQLEnum, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# --- CONFIG ------------------------------------------------------------------

SECRET_KEY = os.getenv("JWT_SECRET", "changeme-in-prod")
ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://user:pass@db:5432/srmonitor"
)

# --- DB SETUP ----------------------------------------------------------------

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- MODELS ------------------------------------------------------------------

class RoleEnum(str, Enum):
    viewer   = "viewer"
    operator = "operator"
    admin    = "admin"

class User(Base):
    __tablename__ = "users"
    id       = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role     = Column(SQLEnum(RoleEnum), default=RoleEnum.viewer, nullable=False)
    created  = Column(DateTime, default=datetime.utcnow)

class ShellyStatus(Base):
    __tablename__ = "shelly_status"
    id        = Column(Integer, primary_key=True, index=True)
    state     = Column(String, nullable=False)
    temp      = Column(Float, nullable=False)
    battery   = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

# --- Pydantic Schemas --------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str
    role: RoleEnum

class UserCreate(BaseModel):
    username: str
    password: str
    role: RoleEnum = RoleEnum.viewer

class UserOut(BaseModel):
    id: int
    username: str
    role: RoleEnum
    created: datetime
    class Config:
        orm_mode = True

class StatusOut(BaseModel):
    state: str
    temp: float
    battery: float
    timestamp: datetime
    class Config:
        orm_mode = True

# --- SECURITY HELPERS --------------------------------------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

def verify_password(plain: str, hashed: str) -> bool:
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_ctx.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_ctx.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(username=payload.get("sub"), role=RoleEnum(payload.get("role")))
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    tokdata = decode_access_token(token)
    user = db.query(User).filter(User.username == tokdata.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- APP & CORS --------------------------------------------------------------

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],                # im Prod bitte einschränken!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CREATE TABLES & DEFAULT ADMIN ------------------------------------------

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(User).filter_by(username="meinadmin").first():
        admin = User(
            username="meinadmin",
            hashed_password=get_password_hash("sicherespasswort"),
            role=RoleEnum.admin,
        )
        db.add(admin)
        db.commit()
    db.close()

# --- AUTHENTICATION ----------------------------------------------------------

@app.post("/api/token", response_model=Token)
def login_for_token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Falscher Benutzer oder Passwort")
    access_token = create_access_token({"sub": user.username, "role": user.role.value})
    return {"access_token": access_token, "token_type": "bearer"}

# --- USER ENDPOINTS ----------------------------------------------------------

@app.post("/api/users", response_model=UserOut, status_code=201)
def create_user(u: UserCreate, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if me.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Keine Rechte")
    if db.query(User).filter_by(username=u.username).first():
        raise HTTPException(status_code=400, detail="User existiert schon")
    new = User(
        username=u.username,
        hashed_password=get_password_hash(u.password),
        role=u.role,
    )
    db.add(new); db.commit(); db.refresh(new)
    return new

@app.get("/api/users/me", response_model=UserOut)
def read_users_me(me: User = Depends(get_current_user)):
    return me

# --- SHELLY STATUS ENDPOINTS ------------------------------------------------

@app.post("/api/shelly", status_code=201)
def ingest_shelly(s: StatusOut, db: Session = Depends(get_db)):
    db.add(ShellyStatus(**s.dict())); db.commit()
    return {"msg": "ok"}

@app.get("/api/door-status/latest", response_model=StatusOut)
def read_latest_status(db: Session = Depends(get_db)):
    return db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).first()

@app.get("/api/door-status/history", response_model=List[StatusOut])
def read_history(db: Session = Depends(get_db)):
    return db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).limit(50).all()
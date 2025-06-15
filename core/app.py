from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List
import os

# Import your models and schemas
from core.models import Base, engine, SessionLocal, ShellyStatus, User, RoleEnum
from core import schemas

# Import security utilities
from security import hash_password, verify_password, create_access_token, decode_access_token

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

# Dependency: get DB session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Authenticate user credentials

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user

# Token endpoint
@app.post("/api/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(username=user.username, role=user.role.value)
    return {"access_token": access_token, "token_type": "bearer"}

# Helper: retrieve current user from token
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Endpoint: current user info
@app.get("/api/users/me", response_model=schemas.UserRead)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# Endpoint: create new user (admin only)
@app.post("/api/users", response_model=schemas.UserRead)
def create_user(new: schemas.UserCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    user = User(username=new.username, password=hash_password(new.password), role=RoleEnum(new.role))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# Shelly status endpoints
@app.get("/api/door-status/latest", response_model=schemas.ShellyStatusRead)
def get_latest_status(db: Session = Depends(get_db)):
    return db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).first()

@app.get("/api/door-status/history", response_model=List[schemas.ShellyStatusRead])
def get_history(db: Session = Depends(get_db)):
    return db.query(ShellyStatus).order_by(ShellyStatus.timestamp.desc()).limit(100).all()

# Webhook endpoint for simulator/agent
@app.post("/api/shelly", status_code=201)
def receive_shelly(status: schemas.ShellyStatusCreate, db: Session = Depends(get_db)):
    record = ShellyStatus(**status.dict())
    db.add(record)
    db.commit()
    return {"message": "Recorded"}
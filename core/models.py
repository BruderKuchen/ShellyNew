from sqlalchemy import Column, Integer, Float, String, DateTime, Enum
from sqlalchemy.orm import declarative_base
import datetime
import enum

Base = declarative_base()

class RoleEnum(str, enum.Enum):
    viewer  = "viewer"
    auditor = "auditor"
    admin   = "admin"

class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(Enum(RoleEnum), default=RoleEnum.viewer, nullable=False)
    created_at      = Column(DateTime, default=datetime.datetime.utcnow)

class ShellyStatus(Base):
    __tablename__ = "shelly_status"
    id        = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    state     = Column(String)
    temp      = Column(Float)
    battery   = Column(Integer)
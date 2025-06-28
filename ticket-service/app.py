from fastapi import FastAPI, Form, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import secrets
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup
app = FastAPI()
templates = Jinja2Templates(directory="templates")

engine = create_engine("sqlite:///data/tickets.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Model
class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    temperature = Column(Float)

Base.metadata.create_all(bind=engine)

# API model
class TicketCreate(BaseModel):
    title: str
    description: str
    temperature: float

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Security
security = HTTPBasic()

def authenticate(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, os.getenv("TICKET_USER"))
    correct_password = secrets.compare_digest(credentials.password, os.getenv("TICKET_PASS"))
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"},  # 👈 zwingt Browser zur Login-Abfrage
        )
    return credentials

# Routes
@app.get("/", response_class=HTMLResponse)
def read_tickets(
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPBasicCredentials = Depends(authenticate)  # 👈 Login-Schutz für Startseite
):
    tickets = db.query(Ticket).all()
    return templates.TemplateResponse("index.html", {"request": request, "tickets": tickets})

@app.post("/tickets")
def create_ticket(
    title: str = Form(...),
    description: str = Form(...),
    temperature: float = Form(...),
    db: Session = Depends(get_db),
    credentials: HTTPBasicCredentials = Depends(authenticate)  # 👈 schützt das Formular
):
    ticket = Ticket(title=title, description=description, temperature=temperature)
    db.add(ticket)
    db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/api/tickets")
def api_create_ticket(
    ticket: TicketCreate,
    db: Session = Depends(get_db),
    credentials: HTTPBasicCredentials = Depends(authenticate)  # ✅ geschützt
):
    db_ticket = Ticket(
        title=ticket.title,
        description=ticket.description,
        temperature=ticket.temperature
    )
    db.add(db_ticket)
    db.commit()
    return {"message": "Ticket created"}

@app.get("/secure-data")
def read_secure_data(credentials: HTTPBasicCredentials = Depends(authenticate)):  # ✅ angepasst
    return {"data": "This is secured data"}

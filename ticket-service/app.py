from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

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

# Routes
@app.get("/", response_class=HTMLResponse)
def read_tickets(request: Request):
    db = SessionLocal()
    tickets = db.query(Ticket).all()
    db.close()
    return templates.TemplateResponse("index.html", {"request": request, "tickets": tickets})

@app.post("/tickets")
def create_ticket(
    title: str = Form(...),
    description: str = Form(...),
    temperature: float = Form(...)
):
    db = SessionLocal()
    ticket = Ticket(title=title, description=description, temperature=temperature)
    db.add(ticket)
    db.commit()
    db.close()
    return RedirectResponse(url="/", status_code=303)

@app.post("/api/tickets")
def api_create_ticket(ticket: TicketCreate):
    db = SessionLocal()
    db_ticket = Ticket(
        title=ticket.title,
        description=ticket.description,
        temperature=ticket.temperature
    )
    db.add(db_ticket)
    db.commit()
    db.close()
    return {"message": "Ticket created"}

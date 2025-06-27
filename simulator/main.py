from fastapi import FastAPI
from random import uniform, choice

app = FastAPI()
state = False

@app.get("/status")
def status():
    global state
    state = not state
    return {
        "sensor": {"state": "open" if state else "closed"},
        "tmp": {"value": round(uniform(20.0, 25.0), 2)},
        "bat": {"value": choice([100, 99, 98, 97])}
    }

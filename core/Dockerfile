FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Zertifikate ins Image kopieren (vorher im /core-Ordner erzeugen!)
COPY localhost+2.pem localhost+2.pem
COPY localhost+2-key.pem localhost+2-key.pem

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--ssl-keyfile", "localhost+2-key.pem", "--ssl-certfile", "localhost+2.pem"]
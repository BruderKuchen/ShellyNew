ShellyNew

Übersicht

ShellyNew ist eine modulare Microservices-Anwendung zur Erfassung und Verarbeitung von Sensordaten eines Shelly-Geräts und zur Verwaltung von Tickets.

Die Architektur umfasst folgende Dienste:
	•	db: PostgreSQL-Datenbank
	•	core: FastAPI-Service zur Authentifizierung und Speicherung von Sensordaten
	•	simulator: Simuliert Sensordaten (Python)
	•	agent: Liest Daten vom realen Shelly-Sensor und sendet sie an Core (Python)
	•	frontend: React-Anwendung mit SSL (HTTPS)
	•	ticket-service: Flask-Service zur Ticketverwaltung (HTTP)

Alle Dienste laufen in Docker-Containern und verwenden ein eigenes Bridge-Netzwerk.

Voraussetzungen
	•	Docker und Docker Compose (Version 2)
	•	Python 3.11 (für lokale Tests ohne Container)
	•	Node.js 18+ (für Frontend-Build)

Setup
	1.	Projekt klonen:

git clone <REPO_URL> ShellyNew-main
cd ShellyNew-main


	2.	Umgebungsvariablen konfigurieren:
	•	Datei .env im Projekt-Root anlegen (nicht ins Git einchecken):

SECRET_KEY=dein-jwt-secret
AGENT_SHARED_SECRET=dein-agent-shared-token
SHELLY_IP=172.20.10.3


	•	In docker-compose.yml unter dem Agent-Service SHELLY_IP auf die IP deines Shelly-Sensors ändern:

environment:
  - SHELLY_IP=${SHELLY_IP}


	3.	SSL-Zertifikate im Ordner crt/ ablegen:
	•	localhost+2.pem
	•	localhost+2-key.pem

Build und Start

Im Projekt-Root ausführen:

docker compose down
docker compose up -d --build

Die Dienste sind dann erreichbar unter:
	•	Core API: http://localhost:8000
	•	Frontend: https://localhost:3000
	•	Ticket-Service: http://localhost:4000

Projektstruktur

ShellyNew-main/
├── .env
├── docker-compose.yml
├── core/
│   ├── Dockerfile
│   ├── app.py
│   └── security.py
├── simulator/
│   ├── Dockerfile
│   └── main.py
├── agent/
│   ├── Dockerfile
│   └── main.py
├── frontend/
│   ├── Dockerfile
│   ├── vite.config.js
│   └── src/
├── ticket-service/
│   ├── Dockerfile
│   ├── app.py
│   └── models.py
├── crt/
│   ├── localhost+2.pem
│   └── localhost+2-key.pem
└── README.md

Hinweise
	•	Die Datei .env enthält sensible Daten und sollte nicht ins Versions­kontroll­system aufgenommen werden.
	•	Der Simulator-Service (simulator/) kann bei Bedarf weiterhin für Tests genutzt werden.

Troubleshooting
	•	Port 5000 belegt: Ticket-Service läuft nun auf Port 4000.
	•	BuildKit-Probleme: Docker BuildKit deaktivieren mit:

export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0


	•	Fehlendes SSL-Zertifikat: Prüfen, ob Zertifikate im crt/-Ordner vorhanden sind.



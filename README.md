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



CODE:


1. Database (db)
	•	Image: postgres:15
	•	Zweck: Speichert alle persistierenden Daten (Sensordaten, Tickets).
	•	Wichtige Dateien: Keine, läuft als Standard-Postgres-Container.
	•	Konfiguration:
	•	Umgebungsvariablen (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB) im Compose-File.
	•	Daten liegen in einem Docker-Volume (db-data), um sie zwischen Neustarts zu behalten.

⸻

2. Core-Service (core/)
	•	Framework: FastAPI
	•	Dateien:
	•	app.py: Definiert die HTTP-Endpoints.
	•	/api/shelly (POST): Empfängt Sensordaten vom Agent (bzw. Simulator).
	•	(Weitere Endpoints für Auth, ggf. Nutzerverwaltung, nicht im Detail hier betrachtet.)
	•	security.py: JWT-Utilities.
	•	create_access_token(): Erzeugt signierte Tokens.
	•	verify_token(): Entschlüsselt und prüft eingehende Tokens.
	•	Wichtige Konzepte:
	•	Dependency Injection: FastAPI-„Depends“ für Authentifizierung.
	•	Pydantic-Modelle (in app.py): Validieren eingehende JSON-Payloads.
	•	Env-Vars: SECRET_KEY und AGENT_SHARED_SECRET werden aus .env geladen. Damit trennt der Core-Service sensible Konfiguration von festem Code.

⸻

3. Simulator (simulator/)
	•	Sprache: Python (aiohttp oder Requests)
	•	Dateien:
	•	main.py:
	•	Startet einen HTTP-Server (Port 80 intern, abgebildet auf 8080 extern).
	•	Generiert in Endlosschleife oder auf Anfrage JSON-Daten mit Zufallswerten für Temperatur, Feuchte, etc.
	•	Zweck: Erlaubt Entwicklung und Tests ohne echten Shelly-Sensor.

⸻

4. Agent (agent/)
	•	Sprache: Python (aiohttp + asyncio)
	•	Dateien:
	•	main.py:
	1.	Fetch: Ruft http://<SHELLY_IP>/status ab — das kann „simulator“ oder deine Shelly-IP sein.
	2.	Parse: Liest JSON-Antwort und extrahiert etwa Temperatur- und Feuchtewerte.
	3.	Push: Sendet die Daten asynchron per POST an http://core:8000/api/shelly mit einem Bearer-Token im Header.
	4.	Loop: Wiederholt das alle X Sekunden oder einmalig in __main__.
	•	Konfiguration:
	•	SHELLY_IP, CORE_ENDPOINT, AGENT_SHARED_SECRET via Env-Vars.
	•	Docker-Compose sorgt dafür, dass diese Variablen aus der .env kommen.

⸻

5. Frontend (frontend/)
	•	Framework: React + Vite + TailwindCSS
	•	Dateien:
	•	vite.config.js:
	•	Konfiguriert HTTPS-Dev-Server mit lokalen Zertifikaten (localhost+2.pem/-key.pem).
	•	src/…: React-Komponenten, die die Sensordaten visuell aufbereiten (Charts, Tabellen).
	•	Dockerfile:
	1.	Builder-Stage: npm install, npm run build → generiert statische Assets in /dist.
	2.	Runtime-Stage: Installiert serve und startet den HTTPS-Server mit den gemounteten Zertifikaten.
	•	Zugriff: https://localhost:3000

⸻

6. Ticket-Service (ticket-service/)
	•	Framework: Flask
	•	Dateien:
	•	app.py: Definiert Endpoints zum Anlegen und Abfragen von Tickets.
	•	models.py: Pydantic- oder SQLAlchemy-Modelle / Datenschemata.
	•	Konfiguration: Läuft jetzt auf Port 4000, um Konflikte mit 5000 zu vermeiden.
	•	Persistenz: Nutzt oft SQLite oder ein eigenes Volume (ticket-data) für Daten.

⸻

7. Docker Compose (docker-compose.yml)
	•	Netzwerk: app-network verbindet alle Container über Service-Namen.
	•	Volumes:
	•	db-data: Postgres-Daten
	•	ticket-data: Tickets
	•	Umgebungsvariablen:
	•	.env wird per env_file geladen.
	•	Sensible Werte (SECRET_KEY, AGENT_SHARED_SECRET, SHELLY_IP) stehen dort.
	•	Ports:
	•	8000:8000 (Core)
	•	8080:80  (Simulator)
	•	3000:3000 (Frontend HTTPS)
	•	4000:4000 (Ticket-Service HTTP)

⸻

Ablauf beim Start
	1.	docker compose up --build
	2.	Core lauscht auf :8000
	3.	Simulator liefert Zufallsdaten auf :8080
	4.	Agent ruft SHELLY_IP ab, sendet an Core
	5.	Frontend verbindet sich via HTTPS zu :3000 und fragt Core-API ab
	6.	Ticket-Service steht unter :4000 für Ticket-CRUD

⸻

Zusammenfassung
	•	Entkopplung: Jeder Service hat klar abgegrenzte Verantwortung.
	•	Sicherheit: Secrets in .env, Bearer-Token zwischen Agent und Core, HTTPS im Frontend.
	•	Flexibilität: Simulator für Tests, echt-Sensor-IP einfach per Env-Var austauschbar.
	•	Skalierbarkeit: Weitere Services (z. B. Alerting) lassen sich leicht hinzufügen.

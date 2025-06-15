import asyncio
import aiohttp
import async_timeout
import subprocess
import os

SHELLY_IP = os.getenv('SHELLY_IP', 'simulator')
CORE_ENDPOINT = os.getenv('CORE_ENDPOINT', 'http://core:8000/api/shelly')

async def ping(host: str) -> bool:
    result = subprocess.run(
        ["ping", "-c", "1", "-W", "1", host],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    return result.returncode == 0

async def fetch_shelly(session: aiohttp.ClientSession) -> dict:
    url = f"http://{SHELLY_IP}/status"
    async with async_timeout.timeout(5):
        resp = await session.get(url)
        return await resp.json()

async def send_to_core(session: aiohttp.ClientSession, data: dict):
    try:
        await session.post(CORE_ENDPOINT, json=data)
    except Exception as e:
        print(f"[WARN] Konnte nicht an Core senden: {e}")

async def main_loop():
    async with aiohttp.ClientSession() as session:
        # einmal sofort prüfen
        try:
            if await ping(SHELLY_IP):
                data = await fetch_shelly(session)
                await send_to_core(session, data)
        except Exception as e:
            print(f"[ERROR] Agent-Start-Fehler: {e}")

        # dann alle 5 Sekunden
        while True:
            try:
                if await ping(SHELLY_IP):
                    data = await fetch_shelly(session)
                    await send_to_core(session, data)
                else:
                    print(f"[INFO] {SHELLY_IP} nicht erreichbar.")
            except Exception as e:
                print(f"[ERROR] Agent-Loop-Fehler: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main_loop())
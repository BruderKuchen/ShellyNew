import asyncio
import aiohttp
import async_timeout
import subprocess
import os
import ssl

# Nutze den Simulator als Shelly-Quelle
SHELLY_IP = os.getenv("SHELLY_IP", "simulator")
CORE_ENDPOINT = os.getenv('CORE_ENDPOINT', 'https://core:8000/api/shelly')

# SSL-Kontext für selbstsignierte Zertifikate (nur für Entwicklung!)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

async def ping(host: str) -> bool:
    result = subprocess.run(
        ["ping", "-c", "1", "-W", "1", host],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    return result.returncode == 0

async def fetch_shelly(session: aiohttp.ClientSession) -> dict:
    url = f"http://{SHELLY_IP}/status"
    try:
        async with async_timeout.timeout(5):
            async with session.get(url) as resp:
                resp.raise_for_status()
                return await resp.json()
    except Exception as e:
        print(f"[ERROR] Shelly fetch failed: {e}")
        return {}

async def send_to_core(session: aiohttp.ClientSession, data: dict):
    if not data:
        return  # skip empty data
    try:
        async with session.post(CORE_ENDPOINT, json=data, ssl=ssl_ctx) as resp:
            resp.raise_for_status()
            print(f"[INFO] Sent data to core, response: {resp.status}")
    except Exception as e:
        print(f"[WARN] Could not send to Core: {e}")

async def main_loop():
    async with aiohttp.ClientSession() as session:
        # initial check
        try:
            if await ping(SHELLY_IP):
                data = await fetch_shelly(session)
                await send_to_core(session, data)
            else:
                print(f"[INFO] {SHELLY_IP} not reachable at startup.")
        except Exception as e:
            print(f"[ERROR] Agent startup error: {e}")

        # periodic check
        while True:
            try:
                if await ping(SHELLY_IP):
                    data = await fetch_shelly(session)
                    await send_to_core(session, data)
                else:
                    print(f"[INFO] {SHELLY_IP} not reachable.")
            except Exception as e:
                print(f"[ERROR] Agent loop error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main_loop())

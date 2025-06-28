// frontend/src/api.js
export async function login(username, password) {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)

  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  if (!res.ok) {
    throw new Error('Login fehlgeschlagen')
  }
  return res.json()  // { access_token, token_type }
}

//Die Funktion login sendet einen POST-Request 
// an /api/token mit Benutzername und Passwort, um ein Token vom 
// Backend zu erhalten.


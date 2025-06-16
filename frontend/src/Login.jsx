import { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const res = await fetch(
      `${import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000`}/api/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
      }
    );

    if (!res.ok) {
      setError("Login fehlgeschlagen");
      return;
    }

    const { access_token } = await res.json();
    localStorage.setItem("token", access_token);

    // Rolle aus JWT-Payload extrahieren
    const [, payload] = access_token.split(".");
    const { role } = JSON.parse(atob(payload));
    onLogin(role);
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>
      <div className="login-overlay"></div>

      <div className="login-content">
        <div className="welcome-section">
          <h1 className="welcome-title">Welcome to Stress</h1>
          <p className="welcome-subtitle">Your Smart Measurements Board</p>
        </div>

        <div className="login-form-container">
          <form onSubmit={handleSubmit} className="login-form">
            <h2 className="form-title">Login</h2>
            {error && <div className="error-message">{error}</div>}
            <div className="input-group">
              <input
                className="form-input"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <input
                className="form-input"
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="login-button">
              Login
            </button>
          </form>
        </div>
      </div>

      <div className="credits">Dominik Bekesi, Sako Chadoian, Altay Celo</div>

      <style jsx>{`
        /* (hier kommt euer kompletter CSS-Block rein, unverändert) */
        .login-container { /* ... */ }
        .login-background { /* ... */ }
        /* ... restliche Styles ... */
      `}</style>
    </div>
  );
}

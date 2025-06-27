import { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);

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

    const { access_token, refresh_token } = await res.json();
    onLogin(access_token, refresh_token);
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
        .login-container {
          min-height: 100vh;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .login-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            135deg,
            #0ea5e9 0%,
            #1e40af 50%,
            #0369a1 100%
          );
          background-image: url("https://images.pexels.com/photos/1435752/pexels-photo-1435752.jpeg");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          filter: brightness(0.8);
        }

        .login-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            135deg,
            rgba(14, 165, 233, 0.4) 0%,
            rgba(30, 64, 175, 0.6) 50%,
            rgba(3, 105, 161, 0.5) 100%
          );
        }

        .login-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 400px;
          padding: 2rem;
          text-align: center;
        }

        .welcome-section {
          margin-bottom: 3rem;
        }

        .welcome-title {
          font-size: 3rem;
          font-weight: bold;
          color: white;
          margin-bottom: 0.5rem;
          text-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          font-family: "Arial", sans-serif;
        }

        .welcome-subtitle {
          font-size: 1.125rem;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          margin: 0;
        }

        .login-form-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 2rem;
          box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .login-form {
          width: 100%;
        }

        .form-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .error-message {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
          text-align: center;
        }

        .input-group {
          margin-bottom: 1rem;
        }

        .form-input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease-in-out;
          background-color: #fafafa;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          background-color: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-input::placeholder {
          color: #9ca3af;
        }

        .login-button {
          width: 100%;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border: none;
          padding: 0.875rem 1rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          margin-top: 0.5rem;
        }

        .login-button:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
          transform: translateY(-1px);
          box-shadow:
            0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        .login-button:active {
          transform: translateY(0);
        }

        .credits {
          position: fixed;
          bottom: 1rem;
          left: 1rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
          z-index: 20;
          font-weight: 500;
          letter-spacing: 0.025em;
        }

        @media (max-width: 640px) {
          .login-content {
            padding: 1rem;
          }

          .welcome-title {
            font-size: 2rem;
          }

          .login-form-container {
            padding: 1.5rem;
          }

          .credits {
            font-size: 0.75rem;
            bottom: 0.75rem;
            left: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
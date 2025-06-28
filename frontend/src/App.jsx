import React, { useState, useEffect, Fragment } from "react";
import Login from "./Login";
import {
  DoorOpen,
  DoorClosed,
  Thermometer,
  BatteryFull,
  BarChart3,
  Users,
  Trash2,
  HelpCircle,
  X,
  Ticket,
} from "lucide-react";

export default function App() {
  // ─── State Hooks ─────────────────────────────────────────
  const [status, setStatus]       = useState(null);   // Aktueller Türstatus
  const [user, setUser]           = useState(null);   // Eingeloggter Benutzer
  const [history, setHistory]     = useState([]);     // Verlauf der Türstatus
  const [users, setUsers]         = useState([]);     // Benutzerliste
  const [newUser, setNewUser]     = useState({ username: "", password: "", role: "viewer" }); // Neuer Benutzer
  const [activeTab, setActiveTab] = useState("dashboard"); // Aktiver Tab
  const [showHelpPopup, setShowHelpPopup] = useState(false); // Hilfe-Popup

  // Basis-URL für API-Requests (immer HTTPS als Fallback!)
  const API_BASE = import.meta.env.VITE_API_BASE || `https://${window.location.hostname}:8000`;

  // ─── Login-Handler: Token speichern & Rolle laden ───────
  const handleLogin = async (token) => {
    localStorage.setItem("token", token);
    // Versuche, die Rolle vom Backend zu holen
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { role } = await res.json();
        setUser({ role });
        return;
      }
    } catch {}
    // Fallback: Rolle aus JWT-Token extrahieren
    try {
      const [, payload] = token.split(".");
      const { role } = JSON.parse(atob(payload));
      setUser({ role: role || "viewer" });
    } catch {
      setUser({ role: "viewer" });
    }
  };

  // ─── Beim Laden: Token prüfen & User setzen ─────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (token.startsWith("fake.")) {
      try {
        const [, p] = token.split(".");
        const { role } = JSON.parse(atob(p));
        setUser({ role });
      } catch {
        localStorage.removeItem("token");
      }
    } else {
      handleLogin(token);
    }
  }, []);

  // ─── Daten vom Backend holen ─────────────────────────────
  const fetchStatus = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/door-status/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch {}
  };

  const fetchHistory = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/door-status/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHistory(await res.json());
    } catch {}
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {}
  };

  // ─── Wenn User eingeloggt: Daten laden & Status poll-en ─
  useEffect(() => {
    if (!user) return;
    setActiveTab("dashboard");
    fetchStatus();
    fetchHistory();
    fetchUsers();
    const iv = setInterval(fetchStatus, 5000); // Status alle 5s aktualisieren
    return () => clearInterval(iv);
  }, [user]);

  // ─── Benutzerverwaltung ────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    await fetch(`${API_BASE}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newUser),
    });
    fetchUsers();
    setNewUser({ username: "", password: "", role: "viewer" });
  };

  const handleDeleteUser = async (id) => {
    const token = localStorage.getItem("token");
    if (!confirm("Are you sure?")) return;
    await fetch(`${API_BASE}/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  // ─── Navigation & Titel ────────────────────────────────
  const getNavItems = (role) => {
    const items = [{ id: "dashboard",   label: "Dashboard",      icon: BarChart3 }];
    if (role === "auditor" || role === "admin")
      items.push({ id: "logs",        label: "Logs",           icon: DoorClosed });
    if (role === "admin") {
      items.push({ id: "users",       label: "User Management", icon: Users });
      items.push({ id: "tickets",     label: "Tickets",        icon: Ticket });
    }
    return items;
  };
  const getDashboardTitle = (role) => {
    if (role === "admin")   return "Admin Dashboard";
    if (role === "auditor") return "Auditor Dashboard";
    return "Viewer Dashboard";
  };

  // ─── Login-Ansicht ─────────────────────────────────────
  if (!user) return <Login onLogin={handleLogin} />;

  // ─── Ladeanzeige ───────────────────────────────────────
  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const DoorIcon = status.state === "open" ? DoorOpen : DoorClosed;
  const navItems = getNavItems(user.role);

  // ─── Dashboard ─────────────────────────────────────────
  const renderDashboard = () => (
    <Fragment>
      <h2 className="text-2xl font-bold mb-4">Live Measurements</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-lg shadow text-center">
          <DoorIcon size={48} className={status.state==="open"?"text-red-500":"text-green-500"} />
          <p className="mt-2 text-xl capitalize">{status.state}</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow text-center">
          <Thermometer size={48} className="text-blue-500" />
          <p className="mt-2 text-xl">{status.temp}°C</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow text-center">
          <BatteryFull size={48} className="text-green-500" />
          <p className="mt-2 text-xl">{status.battery}%</p>
        </div>
      </div>
    </Fragment>
  );

  // ─── Logs ──────────────────────────────────────────────
  const renderLogs = () => (
    <Fragment>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Measurement History</h2>
        <button onClick={fetchHistory} className="px-4 py-2 bg-blue-500 text-white rounded">
          Refresh
        </button>
      </div>
      <ul className="bg-white rounded shadow divide-y">
        {history.map((h, i) => (
          <li key={i} className="p-4 flex justify-between">
            <span>{new Date(h.timestamp).toLocaleString()}</span>
            <span className={h.state==="open"?"text-red-500":"text-green-500"}>{h.state}</span>
          </li>
        ))}
      </ul>
    </Fragment>
  );

  // ─── Benutzerverwaltung ────────────────────────────────
  const renderUsers = () => (
    <Fragment>
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      <form onSubmit={handleCreateUser} className="space-y-2 mb-6">
        <input
          className="border p-2 rounded w-full"
          placeholder="Username"
          required
          value={newUser.username}
          onChange={e => setNewUser({ ...newUser, username: e.target.value })}
        />
        <input
          className="border p-2 rounded w-full"
          placeholder="Password"
          type="password"
          required
          value={newUser.password}
          onChange={e => setNewUser({ ...newUser, password: e.target.value })}
        />
        <select
          className="border p-2 rounded w-full"
          value={newUser.role}
          onChange={e => setNewUser({ ...newUser, role: e.target.value })}
        >
          <option value="viewer">Viewer</option>
          <option value="auditor">Auditor</option>
          <option value="admin">Admin</option>
        </select>
        <button className="px-4 py-2 bg-green-600 text-white rounded">Create User</button>
      </form>
      <table className="w-full bg-white rounded shadow divide-y">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Username</th>
            <th className="p-2 text-left">Role</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="p-2">{u.username}</td>
              <td className="p-2 capitalize">{u.role}</td>
              <td className="p-2">
                {u.role !== "admin" && (
                  <button onClick={() => handleDeleteUser(u.id)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Fragment>
  );

  // ─── Tickets (Platzhalter) ─────────────────────────────
  const renderTickets = () => (
    <Fragment>
      <h2 className="text-2xl font-bold mb-4">Tickets (coming soon)</h2>
      <p>Integration mit Zammad …</p>
    </Fragment>
  );

  // ─── Haupt-UI ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-blue-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{getDashboardTitle(user.role)}</h1>
            <p>Role: <strong>{user.role}</strong></p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              setUser(null);
            }}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Logout
          </button>
        </div>

        {/* Navigation */}
        <div className="mb-6 bg-white rounded shadow">
          <nav className="flex">
            {navItems.map(it => {
              const Ic = it.icon;
              return (
                <button
                  key={it.id}
                  onClick={() => setActiveTab(it.id)}
                  className={`flex-1 text-center py-3 ${
                    activeTab === it.id
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Ic size={18} className="inline-block mr-1" />
                  {it.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded shadow p-6">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "logs"      && renderLogs()}
          {activeTab === "users"     && renderUsers()}
          {activeTab === "tickets"   && renderTickets()}
        </div>
      </div>

      {/* Hilfe-Button */}
      <button
        onClick={() => setShowHelpPopup(true)}
        className="fixed bottom-6 right-6 bg-blue-500 p-4 text-white rounded-full shadow-lg hover:bg-blue-600"
      >
        <HelpCircle size={24} />
      </button>

      {/* Hilfe-Popup */}
      {showHelpPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl max-w-md mx-4 relative">
            <button
              onClick={() => setShowHelpPopup(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <div className="text-center space-y-4">
              <HelpCircle size={48} className="text-blue-500 mx-auto" />
              <h3 className="text-xl font-bold">Need Help?</h3>
              <p className="text-gray-600">“If you have questions… we don’t really know either! 🤷‍♂️”</p>
              <ul className="list-disc pl-5 text-left text-sm text-gray-700 space-y-1">
                <li>Try turning it off and on again</li>
                <li>Check the cables</li>
                <li>Blame the intern</li>
                <li>Coffee solves everything ☕</li>
              </ul>
              <button
                onClick={() => setShowHelpPopup(false)}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
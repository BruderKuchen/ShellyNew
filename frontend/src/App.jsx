import { useState, useEffect, Fragment } from "react";
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
  // ─── State-Hooks ───────────────────────────────────
  const [status, setStatus]       = useState(null);
  const [user, setUser]           = useState(null);
  const [history, setHistory]     = useState([]);
  const [users, setUsers]         = useState([]);
  const [newUser, setNewUser]     = useState({ username: "", password: "", role: "viewer" });
  const [isOffline, setIsOffline] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showHelpPopup, setShowHelpPopup] = useState(false);

  const API_BASE =
    import.meta.env.VITE_API_BASE ||
    `http://${window.location.hostname}:8000`;

  // ─── Login-Handler ──────────────────────────────────
  const handleLogin = async (token) => {
    localStorage.setItem("token", token);

    // Versuche, die Rolle vom Server zu holen
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { role } = await res.json();
        setUser({ role });
        return;
      }
    } catch (err) {
      console.error("Fehler beim Holen der User-Rolle:", err);
    }

    // Fallback: decode JWT direkt
    try {
      const [, payload] = token.split(".");
      const decoded = JSON.parse(atob(payload));
      setUser({ role: decoded.role || "viewer" });
    } catch {
      setUser({ role: "viewer" });
    }
  };

  // ─── Token-Initialisierung ──────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Demo-Token?
    if (token.startsWith("fake.")) {
      try {
        const [, payload] = token.split(".");
        const { role } = JSON.parse(atob(payload));
        setUser({ role });
      } catch {
        localStorage.removeItem("token");
      }
      return;
    }

    // Echtes Token → Rolle vom Backend
    fetchUserInfo(token);
  }, []);

  const fetchUserInfo = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { role } = await res.json();
        setUser({ role });
        return;
      }
    } catch {
      // ignore
    }
    // Fallback-JWT
    try {
      const [, payload] = token.split(".");
      const decoded = JSON.parse(atob(payload));
      setUser({ role: decoded.role || "viewer" });
    } catch {
      setUser({ role: "viewer" });
    }
  };

  // ─── Data-Fetching ──────────────────────────────────
  const fetchStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token || token.startsWith("fake.")) {
      setStatus({ state: "closed", temp: 22.5, battery: 85, offline: true });
      setIsOffline(true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/door-status/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatus(await res.json());
        setIsOffline(false);
      }
    } catch {
      setIsOffline(true);
    }
  };

  const fetchHistory = async () => {
    const token = localStorage.getItem("token");
    if (!token || token.startsWith("fake.")) {
      setHistory([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/door-status/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHistory(await res.json());
    } catch {}
  };

  const fetchUsers = () => {
    // hier echte API‐Route später
    setUsers([]);
  };

  // Polling und Initial-Fetch, wenn user gesetzt
  useEffect(() => {
    if (!user) return;
    setActiveTab("dashboard");
    fetchStatus();
    fetchHistory();
    fetchUsers();
    const iv = setInterval(fetchStatus, 5000);
    return () => clearInterval(iv);
  }, [user]);

  // ─── User-Management ────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    try {
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
      alert("User angelegt!");
    } catch {
      alert("Fehler beim Anlegen");
    }
  };

  const handleDeleteUser = (id) => {
    if (!confirm("Wirklich löschen?")) return;
    setUsers((u) => u.filter((x) => x.id !== id));
  };

  // ─── Navigation & Titel ─────────────────────────────
  const getNavItems = (role) => {
    const items = [{ id: "dashboard", label: "Dashboard", icon: BarChart3 }];
    if (role === "operator" || role === "admin") {
      items.push({ id: "logs",    label: "Logs",            icon: DoorClosed });
    }
    if (role === "admin") {
      items.push({ id: "users",  label: "User Management", icon: Users });
      items.push({ id: "tickets", label: "Tickets",        icon: Ticket });
    }
    return items;
  };

  const getDashboardTitle = (role) => {
    if (role === "admin")    return "Admin Dashboard";
    if (role === "operator") return "Operator Dashboard";
    return "Viewer Dashboard";
  };

  // ─── WICHTIG: Login-Check ────────────────────────────
  if (!user) return <Login onLogin={handleLogin} />;

  // ─── Spinner, solange Status lädt ────────────────────
  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ─── Render-Bestandteile ────────────────────────────
  const DoorIcon = status.state === "open" ? DoorOpen : DoorClosed;
  const navItems = getNavItems(user.role);

  const renderDashboard = () => (
    <Fragment>
      <h2 className="text-2xl font-bold mb-4">Live Measurements</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-lg shadow text-center">
          <DoorIcon
            size={48}
            className={status.state === "open" ? "text-red-500" : "text-green-500"}
          />
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

  const renderLogs = () => (
    <Fragment>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Measurement History</h2>
        <button
          onClick={fetchHistory}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Refresh
        </button>
      </div>
      <ul className="bg-white rounded shadow divide-y">
        {history.map((h, i) => (
          <li key={i} className="p-4 flex justify-between">
            <span>{new Date(h.timestamp).toLocaleString()}</span>
            <span className={h.state === "open" ? "text-red-500" : "text-green-500"}>
              {h.state}
            </span>
          </li>
        ))}
      </ul>
    </Fragment>
  );

  const renderUsers = () => (
    <Fragment>
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      <form onSubmit={handleCreateUser} className="mb-6 space-y-2">
        <input
          placeholder="Username"
          value={newUser.username}
          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          className="border p-2 rounded w-full"
          required
        />
        <input
          placeholder="Password"
          type="password"
          value={newUser.password}
          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
          className="border p-2 rounded w-full"
          required
        />
        <select
          value={newUser.role}
          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
          className="border p-2 rounded w-full"
        >
          <option value="viewer">Viewer</option>
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
          Create User
        </button>
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
          {users.map((u) => (
            <tr key={u.username}>
              <td className="p-2">{u.username}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">
                {u.role !== "admin" && (
                  <button onClick={() => handleDeleteUser(u.username)}>
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

  const renderTickets = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tickets (coming soon)</h2>
      <p>Integration mit Zammad o.Ä.</p>
    </div>
  );

  // ─── Haupt-UI ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-blue-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{getDashboardTitle(user.role)}</h1>
            <p>
              Role: <strong>{user.role}</strong>
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              setUser(null);
              setActiveTab("dashboard");
            }}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Logout
          </button>
        </div>

        {/* Navigation */}
        <div className="mb-6 bg-white rounded shadow">
          <nav className="flex">
            {navItems.map((it) => {
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
          {activeTab === "logs" && renderLogs()}
          {activeTab === "users" && renderUsers()}
          {activeTab === "tickets" && renderTickets()}
        </div>
      </div>

      {/* Help Popup */}
      {showHelpPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg relative max-w-sm">
            <button
              onClick={() => setShowHelpPopup(false)}
              className="absolute top-2 right-2 text-gray-500"
            >
              <X size={20} />
            </button>
            <HelpCircle size={48} className="mx-auto text-blue-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Need Help?</h3>
            <p className="mb-4">Hier deine Tipps oder Links.</p>
            <button
              onClick={() => setShowHelpPopup(false)}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

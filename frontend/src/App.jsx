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
  const [status, setStatus] = useState(null);
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "viewer",
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showHelpPopup, setShowHelpPopup] = useState(false);

  const API_BASE =
    import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000`;

  // Navigation Items nach Rolle
  const getNavItems = (role) => {
    const items = [{ id: "dashboard", label: "Dashboard", icon: BarChart3 }];
    if (role === "operator" || role === "admin") {
      items.push({ id: "logs", label: "Logs", icon: DoorClosed });
    }
    if (role === "admin") {
      items.push({ id: "users", label: "User Management", icon: Users });
      items.push({ id: "tickets", label: "Tickets", icon: Ticket });
    }
    return items;
  };

  // Dashboard-Überschrift je Rolle
  const getDashboardTitle = (role) => {
    if (role === "admin") return "Admin Dashboard";
    if (role === "operator") return "Operator Dashboard";
    return "Viewer Dashboard";
  };

  // Beim Start: vorhandenen Token prüfen
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetchUserInfo(token);
  }, []);

  // Userinfo aus Backend oder JWT ziehen
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
      // Fallback: Rolle aus JWT
      const [, payload] = token.split(".");
      const decoded = JSON.parse(atob(payload));
      setUser({ role: decoded.role || "viewer" });
    } catch {
      setUser(null);
    }
  };

  // Sensor-Status
  const fetchStatus = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/door-status/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      setStatus(null);
    }
  };

  // Verlauf
  const fetchHistory = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/door-status/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHistory(await res.json());
    } catch {}
  };

  // Users (Admin-Tab)
  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch {
      setUsers([]);
    }
  };

  // Lifecycle: wenn user gesetzt, Daten holen + Polling
  useEffect(() => {
    if (!user) return;
    setActiveTab("dashboard");
    fetchStatus();
    fetchHistory();
    fetchUsers();
    const iv = setInterval(fetchStatus, 5000);
    return () => clearInterval(iv);
  }, [user]);

  // User anlegen
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

  // User löschen
  const handleDeleteUser = (id) => {
    if (!confirm("Wirklich löschen?")) return;
    setUsers((u) => u.filter((x) => x.id !== id));
  };

  // wenn nicht eingeloggt
  if (!user) return <Login onLogin={(role) => setUser({ role })} />;

  // wenn noch kein Status geladen
  if (status === null)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );

  const DoorIcon = status.state === "open" ? DoorOpen : DoorClosed;
  const navItems = getNavItems(user.role);

  // Render-Helper...
  const renderDashboard = () => (
    <Fragment>
      <h2 className="text-2xl font-bold mb-4">Live Measurements</h2>
      {/* … dein bestehender JSX-Code */}
    </Fragment>
  );
  const renderLogs = () => (
    <Fragment>
      {/* … */}
    </Fragment>
  );
  const renderUsers = () => (
    <Fragment>
      {/* … */}
    </Fragment>
  );
  const renderTickets = () => (
    <div>
      {/* … */}
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              {getDashboardTitle(user.role)}
            </h1>
            <p>
              Role: <strong>{user.role}</strong>
            </p>
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
      {/* Help-Popup */}
      {showHelpPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          {/* … */}
        </div>
      )}
    </div>
  );
}
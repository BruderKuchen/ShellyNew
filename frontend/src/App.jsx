import { useState, useEffect } from "react";
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
  const [isOffline, setIsOffline] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const API_BASE =
    import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000`;

  // Mock data for when backend is not available
  const mockStatus = {
    state: "closed",
    temp: 22.5,
    battery: 85,
    timestamp: new Date().toISOString(),
    offline: false,
  };

  const mockHistory = [
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      state: "open",
      temp: 21.8,
      battery: 87,
    },
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      state: "closed",
      temp: 22.1,
      battery: 88,
    },
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      state: "open",
      temp: 21.5,
      battery: 89,
    },
  ];

  const mockUsers = [
    { id: 1, username: "admin", role: "admin", created: "2024-01-15" },
    { id: 2, username: "operator1", role: "operator", created: "2024-01-20" },
    { id: 3, username: "viewer1", role: "viewer", created: "2024-01-25" },
    { id: 4, username: "john_doe", role: "operator", created: "2024-01-28" },
  ];

  // Role-based navigation items (defined early to avoid hoisting issues)
  const getNavItems = (userRole) => {
    const baseItems = [
      { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    ];

    if (userRole === "operator" || userRole === "admin") {
      baseItems.push({ id: "logs", label: "Logs", icon: DoorClosed });
    }

    if (userRole === "admin") {
      baseItems.push({ id: "users", label: "User Management", icon: Users });
      baseItems.push({ id: "tickets", label: "Tickets", icon: Ticket });
    }

    return baseItems;
  };

  // Get dashboard title based on role
  const getDashboardTitle = (userRole) => {
    switch (userRole) {
      case "admin":
        return "Admin Dashboard";
      case "operator":
        return "Operator Dashboard";
      case "viewer":
        return "Viewer Dashboard";
      default:
        return "Dashboard";
    }
  };

  // beim Start: Token prüfen
  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("Token found:", token);
    if (!token) return;

    // Check if it's a demo token (starts with "fake.")
    if (token.startsWith("fake.")) {
      try {
        const [, payload] = token.split(".");
        console.log("Demo token payload (base64):", payload);
        const decodedPayload = JSON.parse(atob(payload));
        console.log("Demo decoded payload:", decodedPayload);
        const { role } = decodedPayload;
        console.log("Demo extracted role:", role);
        setUser({ role });
        console.log("Demo user state set with role:", role);
      } catch (error) {
        console.error("Invalid demo token:", error);
        localStorage.removeItem("token");
      }
      return;
    }

    // For real tokens, fetch user info from backend
    fetchUserInfo(token);
  }, []);

  // Fetch user info from backend for real tokens
  const fetchUserInfo = async (token) => {
    try {
      console.log("Fetching user info with real token:", token);

      // Try to get user info from backend
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const userInfo = await res.json();
        console.log("User info from backend:", userInfo);
        const role = userInfo.role || userInfo.user_role || "viewer";
        console.log("Real token extracted role:", role);
        setUser({ role });
        console.log("Real user state set with role:", role);
      } else {
        // If /users/me doesn't exist, try to decode JWT manually
        console.log("Backend /users/me not available, trying JWT decode");
        try {
          const [, payload] = token.split(".");
          console.log("Real token payload (base64):", payload);
          const decodedPayload = JSON.parse(atob(payload));
          console.log("Real decoded payload:", decodedPayload);

          // Try different possible role fields in the token
          const role =
            decodedPayload.role ||
            decodedPayload.user_role ||
            decodedPayload.authorities ||
            decodedPayload.scope ||
            decodedPayload.sub || // subject might contain role info
            "admin"; // default to admin for testing

          console.log("Real token extracted role:", role);
          console.log("Full payload structure:", decodedPayload);
          setUser({ role });
          console.log("Real user state set with role:", role);
        } catch (decodeError) {
          console.error("Could not decode real token:", decodeError);
          // Fallback: assume admin role for testing
          console.log("Using fallback admin role");
          setUser({ role: "admin" });
        }
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
      // Fallback: assume admin role for testing
      console.log("Using fallback admin role due to error");
      setUser({ role: "admin" });
    }
  };

  // Status abrufen with error handling
  const fetchStatus = async () => {
    const token = localStorage.getItem("token");

    // If using demo mode (fake token), use mock data directly
    if (!token || token.startsWith("fake.")) {
      console.log("Demo mode: Using mock status data");
      setStatus(mockStatus);
      setIsOffline(true);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE}/api/door-status/latest`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setIsOffline(false);
      } else {
        throw new Error(`API request failed with status: ${res.status}`);
      }
    } catch (error) {
      console.warn("Backend not available, using mock data:", error.message);
      setStatus(mockStatus);
      setIsOffline(true);
    }
  };

  // Verlauf abrufen with error handling
  const fetchHistory = async () => {
    const token = localStorage.getItem("token");

    // If using demo mode (fake token), use mock data directly
    if (!token || token.startsWith("fake.")) {
      console.log("Demo mode: Using mock history data");
      setHistory(mockHistory);
      setIsOffline(true);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE}/api/door-status/history`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        setIsOffline(false);
      } else {
        throw new Error(`API request failed with status: ${res.status}`);
      }
    } catch (error) {
      console.warn("Backend not available, using mock history:", error.message);
      setHistory(mockHistory);
      setIsOffline(true);
    }
  };

  // Users abrufen
  const fetchUsers = async () => {
    const token = localStorage.getItem("token");

    if (!token || token.startsWith("fake.")) {
      console.log("Demo mode: Using mock users data");
      setUsers(mockUsers);
      return;
    }

    // In real mode, would fetch from API
    setUsers(mockUsers);
  };

  // Lifecycle: bei user-Change Daten holen
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("token");
    console.log("User changed, role:", user.role);

    // Reset to dashboard when user changes
    setActiveTab("dashboard");

    fetchStatus();
    fetchHistory();
    fetchUsers();

    // Only set interval for real API calls, not demo mode
    if (!token || !token.startsWith("fake.")) {
      const iv = setInterval(fetchStatus, 5000);
      return () => clearInterval(iv);
    }
  }, [user]);

  // Validate active tab based on user role
  useEffect(() => {
    if (!user) return;

    const availableTabs = getNavItems(user.role).map((item) => item.id);
    if (!availableTabs.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [user, activeTab]);

  // Neuen User anlegen with error handling
  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (isOffline) {
      // Demo mode - simulate user creation
      const newId = Math.max(...users.map((u) => u.id)) + 1;
      const newUserData = {
        id: newId,
        username: newUser.username,
        role: newUser.role,
        created: new Date().toISOString().split("T")[0],
      };
      setUsers([...users, newUserData]);
      alert("User successfully created! (Demo Mode)");
      setNewUser({ username: "", password: "", role: "viewer" });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        alert("User angelegt!");
        setNewUser({ username: "", password: "", role: "viewer" });
        fetchUsers();
      } else {
        alert("Fehler beim Anlegen");
      }
    } catch (error) {
      alert("Demo Mode: User würde normalerweise angelegt werden!");
      setNewUser({ username: "", password: "", role: "viewer" });
    }
  };

  // User löschen
  const handleDeleteUser = (userId) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((u) => u.id !== userId));
      alert("User deleted! (Demo Mode)");
    }
  };

  // wenn nicht eingeloggt
  if (!user) return <Login onLogin={() => setUser({})} />;

  // Lade-Indicator
  if (!status)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your measurements...</p>
        </div>
      </div>
    );

  const Icon = status.state === "open" ? DoorOpen : DoorClosed;
  const doorColor = status.state === "open" ? "text-red-500" : "text-green-500";

  const navItems = getNavItems(user.role);
  console.log("Current user role:", user.role);
  console.log("Available nav items:", navItems);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Live Measurements
        </h2>
        <p className="text-gray-600">
          Real-time sensor data from your smart device
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <Icon size={64} className={`mx-auto mb-4 ${doorColor}`} />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Door Status</h3>
          <p className={`text-3xl font-bold capitalize ${doorColor}`}>
            {status.state}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <Thermometer size={64} className="mx-auto mb-4 text-blue-500" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Temperature</h3>
          <p className="text-3xl font-bold text-blue-600">{status.temp}°C</p>
          <div className="mt-4 bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((status.temp / 40) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <BatteryFull size={64} className="mx-auto mb-4 text-green-500" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            Battery Level
          </h3>
          <p className="text-3xl font-bold text-green-600">{status.battery}%</p>
          <div className="mt-4 bg-green-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${status.battery}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">
            Measurement History
          </h2>
          <p className="text-gray-600 mt-1">
            View historical sensor data and events
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors duration-200 font-medium"
        >
          Refresh Data
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Recent Events</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {history.map((h, index) => (
            <div
              key={h.timestamp || index}
              className="px-6 py-4 hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-3 h-3 rounded-full ${h.state === "open" ? "bg-red-500" : "bg-green-500"}`}
                  ></div>
                  <span className="text-gray-600 font-medium">
                    {new Date(h.timestamp).toLocaleString("de-DE")}
                  </span>
                </div>
                <div className="flex space-x-6 text-sm">
                  <span
                    className={`font-medium ${h.state === "open" ? "text-red-600" : "text-green-600"}`}
                  >
                    Door: {h.state}
                  </span>
                  <span className="text-blue-600">Temp: {h.temp}°C</span>
                  <span className="text-green-600">Battery: {h.battery}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTickets = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Support Tickets</h2>
        <p className="text-gray-600 mt-1">
          Manage support tickets and customer requests
        </p>
      </div>

      {/* Zammad Integration Placeholder */}
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <Ticket size={64} className="mx-auto text-blue-500 mb-4" />
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">
            Zammad Ticketing System
          </h3>
          <p className="text-gray-600 text-lg">
            Integration with Zammad coming soon!
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">
            Planned Features:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="space-y-2">
              <p className="text-gray-700">• View all support tickets</p>
              <p className="text-gray-700">• Create new tickets</p>
              <p className="text-gray-700">• Assign tickets to agents</p>
            </div>
            <div className="space-y-2">
              <p className="text-gray-700">• Track ticket status</p>
              <p className="text-gray-700">• Customer communication</p>
              <p className="text-gray-700">• Generate reports</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 text-sm">
            <strong>🚧 Under Development:</strong> This section will integrate
            directly with your Zammad ticketing system. Stay tuned for updates!
          </p>
        </div>
      </div>

      {/* Mock Tickets Preview */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            Recent Tickets Preview
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Demo data - will be replaced with real Zammad data
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            {
              id: "ZAMMAD-001",
              title: "Login Issues",
              status: "Open",
              priority: "High",
              customer: "john.doe@example.com",
            },
            {
              id: "ZAMMAD-002",
              title: "System Performance",
              status: "In Progress",
              priority: "Medium",
              customer: "jane.smith@example.com",
            },
            {
              id: "ZAMMAD-003",
              title: "Feature Request",
              status: "Pending",
              priority: "Low",
              customer: "admin@company.com",
            },
          ].map((ticket) => (
            <div
              key={ticket.id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-mono text-gray-500">
                    {ticket.id}
                  </span>
                  <span className="font-medium text-gray-900">
                    {ticket.title}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ticket.status === "Open"
                        ? "bg-red-100 text-red-800"
                        : ticket.status === "In Progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {ticket.status}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ticket.priority === "High"
                        ? "bg-red-100 text-red-800"
                        : ticket.priority === "Medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                    }`}
                  >
                    {ticket.priority}
                  </span>
                  <span className="text-gray-600">{ticket.customer}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">User Management</h2>
        <p className="text-gray-600 mt-1">
          Manage user accounts and permissions
        </p>
      </div>

      {/* Create New User */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Create New User
        </h3>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Username"
              value={newUser.username}
              onChange={(e) =>
                setNewUser({ ...newUser, username: e.target.value })
              }
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={newUser.password}
              onChange={(e) =>
                setNewUser({ ...newUser, password: e.target.value })
              }
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors duration-200 font-medium"
          >
            Create User
          </button>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Current Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === "admin"
                          ? "bg-red-100 text-red-800"
                          : user.role === "operator"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.created}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.username !== "admin" && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900 transition-colors duration-200"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div
      key={user.role}
      className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100"
    >
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {getDashboardTitle(user.role)}
              </h1>
              <p className="text-gray-600 mt-1">
                Role:{" "}
                <span className="font-semibold capitalize">{user.role}</span>
              </p>
              {isOffline && (
                <p className="text-amber-600 text-sm mt-1 flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                  Demo Mode - Using mock data
                </p>
              )}
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                setUser(null);
              }}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <nav className="flex space-x-8 px-6">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === item.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <IconComponent size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "logs" &&
            (user.role === "operator" || user.role === "admin") &&
            renderLogs()}
          {activeTab === "users" && user.role === "admin" && renderUsers()}
          {activeTab === "tickets" && user.role === "admin" && renderTickets()}
        </div>

        {/* Floating Help Button */}
        <button
          onClick={() => setShowHelpPopup(true)}
          className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-40"
          title="Need Help?"
        >
          <HelpCircle size={24} />
        </button>

        {/* Help Popup */}
        {showHelpPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 relative">
              <button
                onClick={() => setShowHelpPopup(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X size={20} />
              </button>

              <div className="text-center">
                <div className="mb-4">
                  <HelpCircle size={48} className="mx-auto text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Need Help? 🤔
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  "If you have questions? Don't ask us... we don't know what
                  we're doing either! 🤷‍♂️"
                </p>
                <p className="text-sm text-gray-500 mb-6 italic">
                  - The Development Team (probably debugging something right
                  now)
                </p>
                <div className="space-y-2 text-left text-sm text-gray-600 mb-6">
                  <p>
                    💡 <strong>Pro Tips:</strong>
                  </p>
                  <p>• Try turning it off and on again</p>
                  <p>• Check if it's plugged in</p>
                  <p>• Blame it on the intern</p>
                  <p>• Coffee solves everything ☕</p>
                </div>
                <button
                  onClick={() => setShowHelpPopup(false)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors duration-200"
                >
                  Got it! (I think...)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

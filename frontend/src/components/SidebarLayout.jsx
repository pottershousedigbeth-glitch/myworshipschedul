import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Music, Calendar, Menu, X, Shield, LogOut, Settings, Lightbulb, Eye, EyeOff, BarChart3, Sun, Moon, ArrowLeftRight, Hand, Bell, BellOff, Send, Loader2, ClipboardList } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SidebarLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appTitle, setAppTitle] = useState("Potter House Birmingham");
  const [appSubtitle, setAppSubtitle] = useState("Worship Team");
  const [pendingSwapCount, setPendingSwapCount] = useState(0);
  const [availableSwapCount, setAvailableSwapCount] = useState(0);
  const { user, logout, isMasterAdmin, canSwitchView, toggleViewMode, isViewingAsMember, getEffectiveRole, canEdit } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  
  // Get token for push notifications
  const token = localStorage.getItem("token");
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    loading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTestNotification,
    requiresPWA
  } = usePushNotifications(token);

  const handlePushToggle = async () => {
    if (pushSubscribed) {
      const success = await unsubscribePush();
      if (success) {
        toast.success('Notifications disabled');
      } else {
        toast.error('Failed to disable notifications');
      }
    } else {
      const success = await subscribePush();
      if (success) {
        toast.success('Notifications enabled! You\'ll be alerted when scheduled for a service.');
      } else {
        toast.error('Failed to enable notifications. Please check browser permissions.');
      }
    }
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotification();
    if (success) {
      toast.success('Test notification sent!');
    } else {
      toast.error('Failed to send test notification');
    }
  };

  // Fetch app settings
  useEffect(() => {
    const fetchAppSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings/app`);
        setAppTitle(res.data.app_title || "Potter House Birmingham");
        setAppSubtitle(res.data.app_subtitle || "Worship Team");
      } catch (error) {
        console.error("Failed to fetch app settings");
      }
    };
    fetchAppSettings();
  }, []);

  // Fetch pending swap request count for admins
  useEffect(() => {
    const fetchPendingSwaps = async () => {
      if (!canEdit()) return;
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/swap-requests/pending/count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPendingSwapCount(res.data.count || 0);
      } catch (error) {
        console.error("Failed to fetch pending swap count");
      }
    };
    fetchPendingSwaps();
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingSwaps, 30000);
    return () => clearInterval(interval);
  }, [canEdit]);

  // Fetch available swap requests count for members
  useEffect(() => {
    const fetchAvailableSwaps = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/swap-requests/available`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAvailableSwapCount(res.data?.length || 0);
      } catch (error) {
        console.error("Failed to fetch available swap count");
      }
    };
    fetchAvailableSwaps();
    // Poll every 30 seconds
    const interval = setInterval(fetchAvailableSwaps, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/team", icon: Users, label: "Team" },
    { to: "/songs", icon: Music, label: "Songs" },
    { to: "/suggestions", icon: Lightbulb, label: "Suggestions" },
    { to: "/schedule", icon: Calendar, label: "Schedule" },
    { to: "/my-requests", icon: Hand, label: "Help Out", badge: availableSwapCount },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  // Add Requests and Analytics link for admins only
  if (canEdit()) {
    navItems.splice(6, 0, { to: "/requests", icon: ArrowLeftRight, label: "Requests", badge: pendingSwapCount });
    navItems.splice(7, 0, { to: "/analytics", icon: BarChart3, label: "Analytics" });
    navItems.splice(8, 0, { to: "/admin-tasks", icon: ClipboardList, label: "Admin Tasks" });
  }

  // Add Users link for master admin
  if (isMasterAdmin()) {
    navItems.push({ to: "/users", icon: Shield, label: "Users" });
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getRoleBadge = () => {
    const effectiveRole = getEffectiveRole();
    switch (effectiveRole) {
      case "master_admin":
        return "Master Admin";
      case "admin":
        return "Admin";
      default:
        return "Member";
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-12 left-4 z-50 md:hidden bg-white dark:bg-slate-800 shadow-md dark:text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
        data-testid="mobile-menu-btn"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </Button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar fixed md:static inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full p-6 overflow-y-auto">
          {/* Logo */}
          <div className="mb-6 flex-shrink-0">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Music className="text-amber-500 flex-shrink-0" size={24} />
              <span className="leading-tight">{appTitle}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">{appSubtitle}</p>
          </div>

          {/* User info */}
          {user && (
            <div className="mb-4 p-3 rounded-xl bg-white/10 flex-shrink-0">
              <p className="text-white font-medium truncate">{user.name}</p>
              <p className="text-slate-400 text-xs truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  isViewingAsMember() 
                    ? "bg-blue-500/20 text-blue-400" 
                    : "bg-amber-500/20 text-amber-400"
                }`}>
                  {isViewingAsMember() ? "Viewing as Member" : getRoleBadge()}
                </span>
              </div>
              {/* View Mode Toggle Slider */}
              {canSwitchView() && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Member View</span>
                  <button
                    onClick={toggleViewMode}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                      isViewingAsMember() ? "bg-amber-500" : "bg-slate-600"
                    }`}
                    data-testid="view-toggle-btn"
                    aria-label="Toggle member view"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                        isViewingAsMember() ? "translate-x-5" : "translate-x-0"
                      }`}
                    >
                      {isViewingAsMember() ? (
                        <Eye size={12} className="text-amber-500" />
                      ) : (
                        <EyeOff size={12} className="text-slate-400" />
                      )}
                    </span>
                  </button>
                </div>
              )}
              
              {/* Dark Mode Toggle */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">Dark Mode</span>
                <button
                  onClick={toggleDarkMode}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    isDarkMode ? "bg-indigo-500" : "bg-slate-600"
                  }`}
                  data-testid="dark-mode-toggle"
                  aria-label="Toggle dark mode"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                      isDarkMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  >
                    {isDarkMode ? (
                      <Moon size={12} className="text-indigo-500" />
                    ) : (
                      <Sun size={12} className="text-amber-500" />
                    )}
                  </span>
                </button>
              </div>
              
              {/* Push Notifications Toggle */}
              {pushSupported ? (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Bell size={12} className="mr-1" />
                    Notifications
                    {pushSubscribed && (
                      <button
                        onClick={handleTestNotification}
                        className="text-amber-400 hover:text-amber-300 ml-1"
                        title="Send test notification"
                      >
                        <Send size={10} />
                      </button>
                    )}
                  </span>
                  {pushLoading ? (
                    <Loader2 size={16} className="text-slate-400 animate-spin" />
                  ) : (
                    <button
                      onClick={handlePushToggle}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                        pushSubscribed ? "bg-green-500" : "bg-slate-600"
                      }`}
                      data-testid="push-notifications-toggle"
                      aria-label="Toggle push notifications"
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                          pushSubscribed ? "translate-x-5" : "translate-x-0"
                        }`}
                      >
                        {pushSubscribed ? (
                          <Bell size={12} className="text-green-500" />
                        ) : (
                          <BellOff size={12} className="text-slate-400" />
                        )}
                      </span>
                    </button>
                  )}
                </div>
              ) : requiresPWA ? (
                <div className="mt-3">
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <Bell size={12} />
                    <span>Install app for notifications</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                    Tap <span className="inline-block px-1 bg-slate-700 rounded">Share</span> then "Add to Home Screen"
                  </p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1">
                  <BellOff size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500">
                    Notifications not supported
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto min-h-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon size={18} />
                <span className="font-medium text-sm flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="pt-4 mt-2 border-t border-slate-700 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200"
              data-testid="logout-btn"
            >
              <LogOut size={18} />
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-0 min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-200">
        <div className="p-6 md:p-8 lg:p-12 pt-16 md:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

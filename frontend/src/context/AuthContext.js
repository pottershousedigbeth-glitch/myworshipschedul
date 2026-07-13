import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [viewAsRole, setViewAsRole] = useState(null); // null means view as actual role
  const justLoggedIn = useRef(false);

  useEffect(() => {
    // Set axios header whenever token changes
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      // Only fetch user if we didn't just login (avoids race condition)
      if (!justLoggedIn.current) {
        fetchUser();
      } else {
        justLoggedIn.current = false;
        setLoading(false);
      }
    } else {
      delete axios.defaults.headers.common["Authorization"];
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (error) {
      console.error("Failed to fetch user", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = res.data;
    
    // Set flag to prevent useEffect from fetching user again
    justLoggedIn.current = true;
    
    // Store token and update headers
    localStorage.setItem("token", newToken);
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    
    // Set user first, then token (to ensure user is set before navigation)
    setUser(userData);
    setToken(newToken);
    setLoading(false);
    setViewAsRole(null); // Reset view mode on login
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    setViewAsRole(null);
  };

  // Get the effective role (actual or simulated)
  const getEffectiveRole = () => {
    if (viewAsRole) return viewAsRole;
    return user?.role;
  };

  const canEdit = () => {
    const effectiveRole = getEffectiveRole();
    return user && (effectiveRole === "master_admin" || effectiveRole === "admin");
  };

  const isMasterAdmin = () => {
    const effectiveRole = getEffectiveRole();
    return user && effectiveRole === "master_admin";
  };

  // Check if user can switch views (only admins)
  const canSwitchView = () => {
    return user && (user.role === "master_admin" || user.role === "admin");
  };

  // Toggle view as member/admin
  const toggleViewMode = () => {
    if (!canSwitchView()) return;
    
    if (viewAsRole === "member") {
      setViewAsRole(null); // Back to actual role
    } else {
      setViewAsRole("member"); // View as member
    }
  };

  // Check if currently viewing as member
  const isViewingAsMember = () => {
    return viewAsRole === "member";
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout, 
      canEdit, 
      isMasterAdmin,
      canSwitchView,
      toggleViewMode,
      isViewingAsMember,
      getEffectiveRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

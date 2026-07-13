import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import SidebarLayout from "@/components/SidebarLayout";
import Dashboard from "@/pages/Dashboard";
import TeamMembers from "@/pages/TeamMembers";
import Songs from "@/pages/Songs";
import Schedule from "@/pages/Schedule";
import ServiceDetail from "@/pages/ServiceDetail";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import SongSuggestions from "@/pages/SongSuggestions";
import Analytics from "@/pages/Analytics";
import SwapRequests from "@/pages/SwapRequests";
import MySwapRequests from "@/pages/MySwapRequests";
import AdminTasks from "@/pages/AdminTasks";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const MasterAdminRoute = ({ children }) => {
  const { user, loading, isMasterAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isMasterAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading, canEdit } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canEdit()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to="/" replace /> : <ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SidebarLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="team" element={<TeamMembers />} />
        <Route path="songs" element={<Songs />} />
        <Route path="suggestions" element={<SongSuggestions />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="service/:id" element={<ServiceDetail />} />
        <Route path="my-requests" element={<MySwapRequests />} />
        <Route
          path="requests"
          element={
            <AdminRoute>
              <SwapRequests />
            </AdminRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <AdminRoute>
              <Analytics />
            </AdminRoute>
          }
        />
        <Route 
          path="admin-tasks" 
          element={
            <AdminRoute>
              <AdminTasks />
            </AdminRoute>
          }
        />
        <Route path="settings" element={<Settings />} />
        <Route
          path="users"
          element={
            <MasterAdminRoute>
              <Users />
            </MasterAdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;

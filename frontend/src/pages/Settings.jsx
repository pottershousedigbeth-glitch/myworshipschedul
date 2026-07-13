import { useState, useEffect } from "react";
import { User, Lock, Save, Eye, EyeOff, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const { user, canEdit } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // App settings state
  const [appTitle, setAppTitle] = useState("");
  const [appSubtitle, setAppSubtitle] = useState("");
  const [savingAppSettings, setSavingAppSettings] = useState(false);

  // Load app settings
  useEffect(() => {
    const fetchAppSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings/app`);
        setAppTitle(res.data.app_title || "");
        setAppSubtitle(res.data.app_subtitle || "");
      } catch (error) {
        console.error("Failed to fetch app settings");
      }
    };
    fetchAppSettings();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setSavingProfile(true);
    try {
      await axios.put(`${API}/auth/profile`, { name });
      toast.success("Profile updated!");
      // Refresh user data
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleUpdateAppSettings = async (e) => {
    e.preventDefault();
    if (!appTitle.trim()) {
      toast.error("App title cannot be empty");
      return;
    }

    setSavingAppSettings(true);
    try {
      await axios.put(`${API}/settings/app`, {
        app_title: appTitle,
        app_subtitle: appSubtitle,
      });
      toast.success("App settings updated! Refresh the page to see changes.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update app settings");
    } finally {
      setSavingAppSettings(false);
    }
  };

  const getRoleBadge = () => {
    switch (user?.role) {
      case "master_admin":
        return { label: "Master Admin", color: "bg-purple-100 text-purple-700" };
      case "admin":
        return { label: "Admin", color: "bg-blue-100 text-blue-700" };
      default:
        return { label: "Member", color: "bg-slate-100 text-slate-700" };
    }
  };

  const roleBadge = getRoleBadge();

  return (
    <div className="page-container space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card className="border-0 shadow-sm" data-testid="profile-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <User size={20} className="text-blue-600" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="mt-1 bg-slate-50"
                />
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1"
                  data-testid="settings-name-input"
                />
              </div>
              <div>
                <Label>Role</Label>
                <div className="mt-1">
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Role can only be changed by Master Admin</p>
              </div>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700"
                disabled={savingProfile}
                data-testid="save-profile-btn"
              >
                {savingProfile ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="border-0 shadow-sm" data-testid="password-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Lock size={20} className="text-amber-600" /> Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pr-10"
                    data-testid="current-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="pr-10"
                    data-testid="new-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1"
                  data-testid="confirm-password-input"
                />
              </div>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700"
                disabled={savingPassword}
                data-testid="change-password-btn"
              >
                {savingPassword ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Lock size={16} className="mr-2" />
                )}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* App Settings Card - Only for Admins */}
        {canEdit() && (
        <Card className="border-0 shadow-sm lg:col-span-2" data-testid="app-settings-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Building size={20} className="text-emerald-600" /> App Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateAppSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="appTitle">App Title</Label>
                  <Input
                    id="appTitle"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    placeholder="e.g. Potter House Birmingham"
                    className="mt-1"
                    data-testid="app-title-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">Main title shown in sidebar and login</p>
                </div>
                <div>
                  <Label htmlFor="appSubtitle">App Subtitle</Label>
                  <Input
                    id="appSubtitle"
                    value={appSubtitle}
                    onChange={(e) => setAppSubtitle(e.target.value)}
                    placeholder="e.g. Worship Team"
                    className="mt-1"
                    data-testid="app-subtitle-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">Subtitle shown below the main title</p>
                </div>
              </div>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={savingAppSettings}
                data-testid="save-app-settings-btn"
              >
                {savingAppSettings ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Save App Settings
              </Button>
            </form>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}

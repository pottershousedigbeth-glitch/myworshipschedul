import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, User, Shield, ShieldCheck, Eye, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLES = [
  { id: "master_admin", label: "Master Admin", icon: ShieldCheck, color: "bg-purple-100 text-purple-700" },
  { id: "admin", label: "Admin", icon: Shield, color: "bg-blue-100 text-blue-700" },
  { id: "member", label: "Member", icon: Eye, color: "bg-slate-100 text-slate-700" },
];

const getRoleInfo = (role) => {
  return ROLES.find(r => r.id === role) || ROLES[2];
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    role: "member",
  });

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingUser) {
      // Update existing user
      try {
        await axios.put(`${API}/users/${editingUser.id}`, {
          name: formData.name,
          role: formData.role,
        });
        toast.success("User updated!");
        setDialogOpen(false);
        resetForm();
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Failed to update user");
      }
    } else {
      // Create new user
      if (!formData.email || !formData.name || !formData.password) {
        toast.error("Please fill in all fields");
        return;
      }
      try {
        await axios.post(`${API}/auth/register`, formData);
        toast.success("User created!");
        setDialogOpen(false);
        resetForm();
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Failed to create user");
      }
    }
  };

  const handleDelete = async (id) => {
    if (id === currentUser.id) {
      toast.error("You cannot delete yourself");
      return;
    }
    try {
      await axios.delete(`${API}/users/${id}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      await axios.post(`${API}/users/${resetUserId}/reset-password`, { new_password: newPassword });
      toast.success("Password reset successfully");
      setResetDialogOpen(false);
      setNewPassword("");
      setResetUserId(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reset password");
    }
  };

  const openResetDialog = (userId) => {
    setResetUserId(userId);
    setNewPassword("");
    setResetDialogOpen(true);
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: "",
      role: user.role,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({ email: "", name: "", password: "", role: "member" });
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6" data-testid="users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Access</h1>
          <p className="text-slate-500 mt-1">Manage who can access the app</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700 rounded-full" data-testid="add-user-btn">
              <Plus size={18} className="mr-2" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="mt-1"
                  disabled={!!editingUser}
                  data-testid="user-email-input"
                />
              </div>
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                  className="mt-1"
                  data-testid="user-name-input"
                />
              </div>
              {!editingUser && (
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Initial password"
                    className="mt-1"
                    data-testid="user-password-input"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                  <SelectTrigger className="mt-1" data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2">
                  <strong>Master Admin:</strong> Full access + user management<br/>
                  <strong>Admin:</strong> Edit schedules, songs, team<br/>
                  <strong>Member:</strong> View only
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" data-testid="save-user-btn">
                  {editingUser ? "Update" : "Create User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="mt-1"
                data-testid="reset-password-input"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} className="bg-amber-600 hover:bg-amber-700" data-testid="confirm-reset-btn">
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="search-users-input"
        />
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const roleInfo = getRoleInfo(user.role);
          const RoleIcon = roleInfo.icon;
          const isCurrentUser = user.id === currentUser.id;
          
          return (
            <Card key={user.id} className="card-hover border-0 shadow-sm" data-testid={`user-card-${user.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="text-slate-400" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {user.name} {isCurrentUser && <span className="text-amber-600">(You)</span>}
                      </h3>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                    <RoleIcon size={14} /> {roleInfo.label}
                  </span>
                  {!isCurrentUser && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openResetDialog(user.id)}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        data-testid={`reset-password-${user.id}`}
                      >
                        <KeyRound size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        data-testid={`edit-user-${user.id}`}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

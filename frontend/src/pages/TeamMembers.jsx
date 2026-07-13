import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, User, Mail, Phone, CalendarOff, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLES = [
  { id: "worship_leader", label: "Worship Leader", color: "bg-indigo-100 text-indigo-700" },
  { id: "singer", label: "Singer", color: "bg-purple-100 text-purple-700" },
  { id: "bass", label: "Bass", color: "bg-blue-100 text-blue-700" },
  { id: "guitarist", label: "Guitarist", color: "bg-amber-100 text-amber-700" },
  { id: "keyboard", label: "Keyboard", color: "bg-emerald-100 text-emerald-700" },
  { id: "drummer", label: "Drummer", color: "bg-rose-100 text-rose-700" },
  { id: "everyone", label: "Everyone", color: "bg-slate-100 text-slate-700" },
];

const getRoleColor = (role) => {
  const found = ROLES.find(r => r.id === role);
  return found ? found.color : "bg-slate-100 text-slate-700";
};

export default function TeamMembers() {
  const { canEdit } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    roles: [],
    notes: "",
  });
  
  // Availability dialog state
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [selectedMemberForAvailability, setSelectedMemberForAvailability] = useState(null);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [newUnavailableDate, setNewUnavailableDate] = useState("");

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API}/team-members`, { headers });
      setMembers(res.data);
    } catch (error) {
      toast.error("Failed to fetch team members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.roles.length === 0) {
      toast.error("Name and at least one role are required");
      return;
    }

    try {
      if (editingMember) {
        await axios.put(`${API}/team-members/${editingMember.id}`, formData);
        toast.success("Team member updated!");
      } else {
        await axios.post(`${API}/team-members`, formData);
        toast.success("Team member added!");
      }
      setDialogOpen(false);
      resetForm();
      fetchMembers();
    } catch (error) {
      toast.error("Failed to save team member");
    }
  };

  const handleDelete = async () => {
    if (!deletingMemberId) return;
    try {
      await axios.delete(`${API}/team-members/${deletingMemberId}`);
      toast.success("Team member deleted");
      setDeleteDialogOpen(false);
      setDeletingMemberId(null);
      fetchMembers();
    } catch (error) {
      toast.error("Failed to delete team member");
    }
  };

  const openEditDialog = (member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email || "",
      phone: member.phone || "",
      roles: member.roles,
      notes: member.notes || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingMember(null);
    setFormData({ name: "", email: "", phone: "", roles: [], notes: "" });
  };

  const toggleRole = (roleId) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }));
  };

  // Availability management functions
  const openAvailabilityDialog = (member) => {
    setSelectedMemberForAvailability(member);
    setUnavailableDates(member.unavailable_dates || []);
    setNewUnavailableDate("");
    setAvailabilityDialogOpen(true);
  };

  const addUnavailableDate = () => {
    if (!newUnavailableDate) return;
    if (unavailableDates.includes(newUnavailableDate)) {
      toast.error("This date is already marked as unavailable");
      return;
    }
    setUnavailableDates([...unavailableDates, newUnavailableDate].sort());
    setNewUnavailableDate("");
  };

  const removeUnavailableDate = (date) => {
    setUnavailableDates(unavailableDates.filter(d => d !== date));
  };

  const saveAvailability = async () => {
    if (!selectedMemberForAvailability) return;
    try {
      await axios.put(
        `${API}/team-members/${selectedMemberForAvailability.id}/availability`,
        { unavailable_dates: unavailableDates },
        { headers }
      );
      toast.success("Availability updated successfully");
      setAvailabilityDialogOpen(false);
      fetchMembers();
    } catch (error) {
      toast.error("Failed to update availability");
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.roles.some(r => r.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6" data-testid="team-members-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Team Members</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your worship team</p>
        </div>
        {canEdit() && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700 rounded-full" data-testid="add-member-btn">
              <Plus size={18} className="mr-2" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="dark:text-white">{editingMember ? "Edit Member" : "Add Team Member"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name" className="dark:text-slate-300">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter name"
                  className="mt-1"
                  data-testid="member-name-input"
                />
              </div>
              <div>
                <Label htmlFor="email" className="dark:text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="mt-1"
                  data-testid="member-email-input"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="dark:text-slate-300">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(123) 456-7890"
                  className="mt-1"
                  data-testid="member-phone-input"
                />
              </div>
              <div>
                <Label className="dark:text-slate-300">Roles *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ROLES.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={role.id}
                        checked={formData.roles.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                        data-testid={`role-checkbox-${role.id}`}
                      />
                      <Label htmlFor={role.id} className="text-sm font-normal cursor-pointer dark:text-slate-300">
                        {role.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="notes" className="dark:text-slate-300">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes"
                  className="mt-1"
                  data-testid="member-notes-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="cancel-member-btn">
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" data-testid="save-member-btn">
                  {editingMember ? "Update" : "Add Member"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white">Delete Team Member</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400 py-4">Are you sure you want to delete this team member? This action cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              data-testid="confirm-delete-member-btn"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Search by name or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
          data-testid="search-members-input"
        />
      </div>

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <User className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
            <p className="text-slate-500 dark:text-slate-400">No team members found</p>
            {canEdit() && (
            <Button
              className="mt-4 bg-amber-600 hover:bg-amber-700"
              onClick={() => setDialogOpen(true)}
              data-testid="add-first-member-btn"
            >
              Add Your First Member
            </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="card-hover border-0 shadow-sm" data-testid={`member-card-${member.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <User className="text-slate-400 dark:text-slate-300" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{member.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.roles.map((role) => (
                          <span key={role} className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleColor(role)}`}>
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {(member.email || member.phone) && (
                  <div className="space-y-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                    {member.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-slate-400" />
                        <span>{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Unavailable dates indicator */}
                {member.unavailable_dates?.length > 0 && (
                  <div className="mb-4 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-medium">
                      <CalendarOff size={14} />
                      <span>{member.unavailable_dates.length} unavailable date{member.unavailable_dates.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}
                {canEdit() && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(member)}
                    className="flex-1"
                    data-testid={`edit-member-${member.id}`}
                  >
                    <Edit size={14} className="mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAvailabilityDialog(member)}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    title="Manage Availability"
                    data-testid={`availability-member-${member.id}`}
                  >
                    <Calendar size={14} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setDeletingMemberId(member.id); setDeleteDialogOpen(true); }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`delete-member-${member.id}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Availability Management Dialog */}
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Calendar className="text-amber-600" size={20} /> Manage Availability
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="font-medium text-slate-900 dark:text-white">{selectedMemberForAvailability?.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Mark dates when this member is unavailable</p>
            </div>

            {/* Add new date */}
            <div>
              <Label className="dark:text-slate-300">Add Unavailable Date</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date"
                  value={newUnavailableDate}
                  onChange={(e) => setNewUnavailableDate(e.target.value)}
                  className="flex-1 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  data-testid="new-unavailable-date-input"
                />
                <Button 
                  onClick={addUnavailableDate}
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={!newUnavailableDate}
                  data-testid="add-unavailable-date-btn"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* List of unavailable dates */}
            <div>
              <Label className="dark:text-slate-300">Unavailable Dates ({unavailableDates.length})</Label>
              {unavailableDates.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">No unavailable dates set</p>
              ) : (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                  {unavailableDates.map((date) => (
                    <div 
                      key={date} 
                      className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
                    >
                      <span className="text-sm text-amber-700 dark:text-amber-300">
                        {formatDate(date)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUnavailableDate(date)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={saveAvailability}
                data-testid="save-availability-btn"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

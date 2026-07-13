import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, Users, Music, Plus, X, Trash2, GripVertical, AlertTriangle, Search, ArrowLeftRight, Edit2, Check, ChevronUp, ChevronDown, Mail, Loader2, Megaphone, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { format, parseISO } from "date-fns";
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

export default function ServiceDetail() {
  const { canEdit, user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [members, setMembers] = useState([]);
  const [songs, setSongs] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Edit mode states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [tempDate, setTempDate] = useState("");
  const [tempTime, setTempTime] = useState("");
  
  // Drag and drop state
  const [draggedSongIndex, setDraggedSongIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchCurrentIndex, setTouchCurrentIndex] = useState(null);
  
  // Dialog states
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [songDialogOpen, setSongDialogOpen] = useState(false);
  const [recentSongConfirmOpen, setRecentSongConfirmOpen] = useState(false);
  const [recentMemberConfirmOpen, setRecentMemberConfirmOpen] = useState(false);
  const [pendingSong, setPendingSong] = useState(null);
  const [pendingMember, setPendingMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedSong, setSelectedSong] = useState("");
  const [songSearch, setSongSearch] = useState("");
  
  // Swap request states
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapConfirmOpen, setSwapConfirmOpen] = useState(false);
  const [swapAssignment, setSwapAssignment] = useState(null);
  const [swapReason, setSwapReason] = useState("");
  const [membersAvailability, setMembersAvailability] = useState([]);
  
  // Notify team state
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyConfirmOpen, setNotifyConfirmOpen] = useState(false);
  const [notifyAllLoading, setNotifyAllLoading] = useState(false);
  const [notifyAllConfirmOpen, setNotifyAllConfirmOpen] = useState(false);
  const [notifyingMemberId, setNotifyingMemberId] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchData = async () => {
    try {
      const [serviceRes, membersRes, songsRes, servicesRes, availabilityRes] = await Promise.all([
        axios.get(`${API}/services/${id}`, { headers }),
        axios.get(`${API}/team-members`, { headers }),
        axios.get(`${API}/songs`, { headers }),
        axios.get(`${API}/services`, { headers }),
        axios.get(`${API}/team-members-availability`, { headers }),
      ]);
      setService(serviceRes.data);
      setMembers(membersRes.data);
      setSongs(songsRes.data);
      setAllServices(servicesRes.data);
      setMembersAvailability(availabilityRes.data);
    } catch (error) {
      toast.error("Failed to fetch service details");
      navigate("/schedule");
    } finally {
      setLoading(false);
    }
  };

  // Check if a song was used in the last month
  const getSongLastUsed = (songId) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    
    for (const svc of allServices) {
      if (svc.id === id) continue; // Skip current service
      if (svc.song_slots?.some(slot => slot.song_id === songId)) {
        const serviceDate = new Date(svc.date);
        if (serviceDate >= oneMonthAgo) {
          return { isRecent: true, date: svc.date, serviceName: svc.title || `${svc.day} Service` };
        }
      }
    }
    return { isRecent: false };
  };

  // Check if a member was assigned in the last week
  const getMemberRecentAssignments = (memberId) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentAssignments = [];
    
    for (const svc of allServices) {
      if (svc.id === id) continue; // Skip current service
      const serviceDate = new Date(svc.date);
      
      if (serviceDate >= oneWeekAgo) {
        const memberAssignment = svc.assignments?.find(a => a.member_id === memberId);
        if (memberAssignment) {
          recentAssignments.push({
            date: svc.date,
            day: svc.day,
            time: svc.time,
            role: memberAssignment.role,
            serviceName: svc.title || `${svc.day} Service`
          });
        }
      }
    }
    
    return recentAssignments;
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddMember = async (skipConfirm = false) => {
    const memberToAdd = pendingMember?.memberId || selectedMember;
    const roleToAdd = pendingMember?.role || selectedRole;
    
    if (!memberToAdd || !roleToAdd) {
      toast.error("Please select a member and role");
      return;
    }

    const member = members.find(m => m.id === memberToAdd);
    
    // Check if recently assigned and show confirmation
    if (!skipConfirm) {
      const recentAssignments = getMemberRecentAssignments(memberToAdd);
      if (recentAssignments.length > 0) {
        setPendingMember({ memberId: memberToAdd, role: roleToAdd, recentAssignments });
        setRecentMemberConfirmOpen(true);
        return;
      }
    }
    
    const newAssignment = {
      member_id: member.id,
      member_name: member.name,
      role: roleToAdd,
    };

    const updatedAssignments = [...(service.assignments || []), newAssignment];

    try {
      await axios.put(`${API}/services/${id}`, { assignments: updatedAssignments });
      setService({ ...service, assignments: updatedAssignments });
      toast.success("Member assigned!");
      setMemberDialogOpen(false);
      setRecentMemberConfirmOpen(false);
      setSelectedMember("");
      setSelectedRole("");
      setPendingMember(null);
    } catch (error) {
      toast.error("Failed to assign member");
    }
  };

  const handleRemoveMember = async (index) => {
    const updatedAssignments = service.assignments.filter((_, i) => i !== index);
    try {
      await axios.put(`${API}/services/${id}`, { assignments: updatedAssignments });
      setService({ ...service, assignments: updatedAssignments });
      toast.success("Member removed");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const handleAddSong = async (skipConfirm = false) => {
    const songToAdd = pendingSong || selectedSong;
    if (!songToAdd) {
      toast.error("Please select a song");
      return;
    }

    const song = songs.find(s => s.id === songToAdd);
    
    // Check if recently used and show confirmation
    if (!skipConfirm) {
      const lastUsed = getSongLastUsed(songToAdd);
      if (lastUsed.isRecent) {
        setPendingSong(songToAdd);
        setRecentSongConfirmOpen(true);
        return;
      }
    }

    const finalSong = songs.find(s => s.id === songToAdd);
    const newSlot = {
      song_id: finalSong.id,
      song_title: finalSong.title,
      order: (service.song_slots?.length || 0) + 1,
    };

    const updatedSlots = [...(service.song_slots || []), newSlot];

    try {
      await axios.put(`${API}/services/${id}`, { song_slots: updatedSlots }, { headers });
      setService({ ...service, song_slots: updatedSlots });
      toast.success("Song added!");
      setSongDialogOpen(false);
      setRecentSongConfirmOpen(false);
      setSelectedSong("");
      setPendingSong(null);
    } catch (error) {
      toast.error("Failed to add song");
    }
  };

  const handleRemoveSong = async (index) => {
    const updatedSlots = service.song_slots
      .filter((_, i) => i !== index)
      .map((slot, i) => ({ ...slot, order: i + 1 }));
    
    try {
      await axios.put(`${API}/services/${id}`, { song_slots: updatedSlots }, { headers });
      setService({ ...service, song_slots: updatedSlots });
      toast.success("Song removed");
    } catch (error) {
      toast.error("Failed to remove song");
    }
  };

  // Edit service title
  const startEditingTitle = () => {
    setTempTitle(service.title || "");
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    try {
      await axios.put(`${API}/services/${id}`, { title: tempTitle }, { headers });
      setService({ ...service, title: tempTitle });
      setEditingTitle(false);
      toast.success("Title updated");
    } catch (error) {
      toast.error("Failed to update title");
    }
  };

  // Edit service date
  const startEditingDate = () => {
    setTempDate(service.date);
    setEditingDate(true);
  };

  const saveDate = async () => {
    try {
      // Determine the day of week from the new date
      const dateObj = new Date(tempDate + 'T00:00:00');
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const day = days[dateObj.getDay()];
      
      await axios.put(`${API}/services/${id}`, { date: tempDate, day }, { headers });
      setService({ ...service, date: tempDate, day });
      setEditingDate(false);
      toast.success("Date updated");
    } catch (error) {
      toast.error("Failed to update date");
    }
  };

  // Edit service time
  const startEditingTime = () => {
    setTempTime(service.time || "10:00");
    setEditingTime(true);
  };

  const saveTime = async () => {
    try {
      await axios.put(`${API}/services/${id}`, { time: tempTime }, { headers });
      setService({ ...service, time: tempTime });
      setEditingTime(false);
      toast.success("Time updated");
    } catch (error) {
      toast.error("Failed to update time");
    }
  };

  // Move song up or down (for mobile)
  const moveSong = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= service.song_slots.length) return;

    const updatedSlots = [...service.song_slots];
    const [movedItem] = updatedSlots.splice(index, 1);
    updatedSlots.splice(newIndex, 0, movedItem);
    
    const reorderedSlots = updatedSlots.map((slot, i) => ({ ...slot, order: i + 1 }));

    try {
      await axios.put(`${API}/services/${id}`, { song_slots: reorderedSlots }, { headers });
      setService({ ...service, song_slots: reorderedSlots });
      toast.success("Song order updated");
    } catch (error) {
      toast.error("Failed to reorder songs");
    }
  };

  // Drag and drop handlers for songs (desktop)
  const handleDragStart = (e, index) => {
    setDraggedSongIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedSongIndex === null || draggedSongIndex === dropIndex) {
      setDraggedSongIndex(null);
      return;
    }

    const updatedSlots = [...service.song_slots];
    const [draggedItem] = updatedSlots.splice(draggedSongIndex, 1);
    updatedSlots.splice(dropIndex, 0, draggedItem);
    
    // Update order numbers
    const reorderedSlots = updatedSlots.map((slot, i) => ({ ...slot, order: i + 1 }));

    try {
      await axios.put(`${API}/services/${id}`, { song_slots: reorderedSlots }, { headers });
      setService({ ...service, song_slots: reorderedSlots });
      toast.success("Song order updated");
    } catch (error) {
      toast.error("Failed to reorder songs");
    }
    
    setDraggedSongIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedSongIndex(null);
  };

  const handleDeleteService = async () => {
    try {
      await axios.delete(`${API}/services/${id}`);
      toast.success("Service deleted");
      navigate("/schedule");
    } catch (error) {
      toast.error("Failed to delete service");
    }
  };

  // Handle notify team
  const handleNotifyTeam = async () => {
    if (!service?.assignments?.length) {
      toast.error("No team members assigned to notify");
      return;
    }
    
    setNotifyLoading(true);
    try {
      const response = await axios.post(`${API}/services/${id}/notify-team`, {}, { headers });
      const { sent, failed } = response.data;
      
      if (sent.length > 0) {
        toast.success(`Notifications sent to ${sent.length} team member(s)`);
      }
      if (failed.length > 0) {
        toast.warning(`Failed to notify ${failed.length} member(s): ${failed.map(f => f.name).join(", ")}`);
      }
      setNotifyConfirmOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send notifications");
    } finally {
      setNotifyLoading(false);
    }
  };

  // Handle notify all team members (announcement)
  const handleNotifyAll = async () => {
    setNotifyAllLoading(true);
    try {
      const response = await axios.post(`${API}/services/${id}/notify-all`, {}, { headers });
      const { sent, failed } = response.data;
      
      if (sent.length > 0) {
        toast.success(`Announcement sent to ${sent.length} team member(s)`);
      }
      if (failed.length > 0) {
        toast.warning(`Failed to notify ${failed.length} member(s): ${failed.map(f => f.name).join(", ")}`);
      }
      setNotifyAllConfirmOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send announcement");
    } finally {
      setNotifyAllLoading(false);
    }
  };

  // Handle notify single member
  const handleNotifyMember = async (memberId, memberName) => {
    setNotifyingMemberId(memberId);
    try {
      const response = await axios.post(`${API}/services/${id}/notify-member/${memberId}`, {}, { headers });
      toast.success(`Reminder sent to ${memberName}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to notify ${memberName}`);
    } finally {
      setNotifyingMemberId(null);
    }
  };

  // Get available members for selected role (sorted alphabetically)
  const getAvailableMembers = () => {
    let availableMembers = selectedRole 
      ? members.filter(m => m.roles.includes(selectedRole))
      : members;
    return availableMembers.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Check if a member is unavailable for the service date
  const isMemberUnavailable = (memberId) => {
    if (!service?.date) return false;
    const memberAvail = membersAvailability.find(m => m.id === memberId);
    if (!memberAvail?.unavailable_dates) return false;
    return memberAvail.unavailable_dates.includes(service.date);
  };

  // Handle swap request submission
  const handleSwapRequest = async () => {
    if (!swapAssignment || !swapReason.trim()) {
      toast.error("Please provide a reason for the swap request");
      return;
    }

    try {
      await axios.post(
        `${API}/swap-requests`,
        {
          service_id: service.id,
          member_id: swapAssignment.member_id,
          role: swapAssignment.role,
          reason: swapReason.trim()
        },
        { headers }
      );
      toast.success("Swap request submitted successfully");
      setSwapDialogOpen(false);
      setSwapAssignment(null);
      setSwapReason("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit swap request");
    }
  };

  // Open swap request dialog - show confirmation for members first
  const openSwapDialog = (assignment) => {
    setSwapAssignment(assignment);
    setSwapReason("");
    // Members see confirmation prompt first, admins go directly to swap dialog
    if (canEdit()) {
      setSwapDialogOpen(true);
    } else {
      setSwapConfirmOpen(true);
    }
  };

  // Proceed to swap dialog after confirmation
  const proceedToSwapDialog = () => {
    setSwapConfirmOpen(false);
    setSwapDialogOpen(true);
  };

  // Check if the current user can request a swap for this assignment
  // Admins can swap anyone, members can only swap their own assignments
  const canRequestSwap = (assignment) => {
    if (canEdit()) return true; // Admins can swap anyone
    
    // For members, check if this assignment belongs to them (by matching email)
    const assignedMember = members.find(m => m.id === assignment.member_id);
    if (!assignedMember) return false;
    
    const memberEmail = assignedMember.email?.toLowerCase();
    const userEmail = user?.email?.toLowerCase();
    
    return memberEmail && userEmail && memberEmail === userEmail;
  };

  // Get available songs (filtered by search and sorted alphabetically)
  const getFilteredSongs = () => {
    const assignedSongIds = (service?.song_slots || []).map(s => s.song_id);
    let availableSongs = songs.filter(s => !assignedSongIds.includes(s.id));
    
    // Filter by search term
    if (songSearch.trim()) {
      const searchLower = songSearch.toLowerCase();
      availableSongs = availableSongs.filter(s => 
        s.title.toLowerCase().includes(searchLower) ||
        (s.artist && s.artist.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort alphabetically by title
    return availableSongs.sort((a, b) => a.title.localeCompare(b.title));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!service) return null;

  return (
    <div className="page-container space-y-6" data-testid="service-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/schedule">
            <Button variant="ghost" size="icon" className="rounded-full dark:text-white dark:hover:bg-slate-700" data-testid="back-btn">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div>
            {/* Editable Title */}
            {editingTitle && canEdit() ? (
              <div className="flex items-center gap-2">
                <Input
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="text-2xl font-bold h-10 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  placeholder="Service name..."
                  autoFocus
                  data-testid="edit-title-input"
                />
                <Button size="icon" onClick={saveTitle} className="bg-green-600 hover:bg-green-700 h-10 w-10">
                  <Check size={16} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)} className="h-10 w-10">
                  <X size={16} />
                </Button>
              </div>
            ) : (
              <h1 
                className={`text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2 ${canEdit() ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400' : ''}`}
                onClick={canEdit() ? startEditingTitle : undefined}
                title={canEdit() ? "Click to edit title" : undefined}
              >
                {service.title || `${service.day} Service`}
                {canEdit() && <Edit2 size={16} className="text-slate-400 hover:text-amber-600" />}
              </h1>
            )}
            
            {/* Editable Date and Time */}
            <div className="flex items-center gap-4 mt-1 text-slate-500 dark:text-slate-400">
              {/* Date */}
              {editingDate && canEdit() ? (
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <Input
                    type="date"
                    value={tempDate}
                    onChange={(e) => setTempDate(e.target.value)}
                    className="h-8 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    data-testid="edit-date-input"
                  />
                  <Button size="icon" onClick={saveDate} className="bg-green-600 hover:bg-green-700 h-8 w-8">
                    <Check size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingDate(false)} className="h-8 w-8">
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <span 
                  className={`flex items-center gap-1 ${canEdit() ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400' : ''}`}
                  onClick={canEdit() ? startEditingDate : undefined}
                  title={canEdit() ? "Click to edit date" : undefined}
                >
                  <Calendar size={16} /> {format(parseISO(service.date), "EEEE, MMMM d, yyyy")}
                  {canEdit() && <Edit2 size={12} className="ml-1 text-slate-400" />}
                </span>
              )}
              
              {/* Time */}
              {editingTime && canEdit() ? (
                <div className="flex items-center gap-1">
                  <Clock size={16} />
                  <Input
                    type="time"
                    value={tempTime}
                    onChange={(e) => setTempTime(e.target.value)}
                    className="h-8 w-28 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    data-testid="edit-time-input"
                  />
                  <Button size="icon" onClick={saveTime} className="bg-green-600 hover:bg-green-700 h-8 w-8">
                    <Check size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingTime(false)} className="h-8 w-8">
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <span 
                  className={`flex items-center gap-1 ${canEdit() ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400' : ''}`}
                  onClick={canEdit() ? startEditingTime : undefined}
                  title={canEdit() ? "Click to edit time" : undefined}
                >
                  <Clock size={16} /> {service.time}
                  {canEdit() && <Edit2 size={12} className="ml-1 text-slate-400" />}
                </span>
              )}
            </div>
          </div>
        </div>
        {canEdit() && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid="delete-service-btn"
            >
              <Trash2 size={16} className="mr-2" /> Delete Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="dark:text-white">Delete Service</DialogTitle>
            </DialogHeader>
            <p className="text-slate-600 dark:text-slate-400 py-4">Are you sure you want to delete this service? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  handleDeleteService();
                }}
                data-testid="confirm-delete-btn"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Assignments */}
        <Card className="border-0 shadow-sm" data-testid="assignments-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2 dark:text-white">
              <Users size={20} className="text-blue-600 dark:text-blue-400" /> Team
            </CardTitle>
            <div className="flex gap-2">
              {canEdit() && service?.assignments?.length > 0 && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="rounded-full border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20" 
                  onClick={() => setNotifyConfirmOpen(true)}
                  data-testid="notify-team-btn"
                >
                  <Mail size={16} className="mr-1" /> Notify Team
                </Button>
              )}
              {canEdit() && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="rounded-full border-purple-500 text-purple-600 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/20" 
                  onClick={() => setNotifyAllConfirmOpen(true)}
                  data-testid="notify-all-btn"
                >
                  <Megaphone size={16} className="mr-1" /> Announce
                </Button>
              )}
              {canEdit() && (
              <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 rounded-full" data-testid="add-assignment-btn">
                    <Plus size={16} className="mr-1" /> Assign
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="dark:text-white">Assign Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label className="dark:text-slate-300">Role</Label>
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger className="mt-1" data-testid="assign-role-select">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="dark:text-slate-300">Member</Label>
                      <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="mt-1" data-testid="assign-member-select">
                          <SelectValue placeholder="Select member" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableMembers().map((m) => {
                            const recentAssignments = getMemberRecentAssignments(m.id);
                            const isRecent = recentAssignments.length > 0;
                            const isUnavailable = isMemberUnavailable(m.id);
                            return (
                              <SelectItem 
                                key={m.id} 
                                value={m.id}
                                className={`${isRecent ? "text-red-600 font-medium" : ""} ${isUnavailable ? "text-amber-600 font-medium bg-amber-50 dark:bg-amber-900/20" : ""}`}
                              >
                                {m.name}
                                {isRecent && " ⚠️"}
                                {isUnavailable && " 🚫"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      <span className="text-red-600">⚠️ Red</span> = assigned within last week | <span className="text-amber-600">🚫 Yellow</span> = marked unavailable
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => handleAddMember(false)} data-testid="confirm-assign-btn">
                      Assign
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            )}

            {/* Recent Member Confirmation Dialog */}
            <Dialog open={recentMemberConfirmOpen} onOpenChange={setRecentMemberConfirmOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle size={20} /> Team Member Recently Assigned
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-slate-600 dark:text-slate-400">
                    This team member has been assigned to services within the last week. Are you sure you want to assign them again?
                  </p>
                  {pendingMember && (() => {
                    const member = members.find(m => m.id === pendingMember.memberId);
                    const roleLabel = ROLES.find(r => r.id === pendingMember.role)?.label || pendingMember.role;
                    return (
                      <div className="mt-3 space-y-2">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="font-medium text-slate-900 dark:text-white">{member?.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Assigning as: {roleLabel}</p>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Recent assignments:</p>
                          <div className="space-y-1">
                            {pendingMember.recentAssignments.map((a, idx) => (
                              <p key={idx} className="text-sm text-red-600 dark:text-red-400">
                                • {a.serviceName} - {new Date(a.date).toLocaleDateString()} ({a.time}) - {ROLES.find(r => r.id === a.role)?.label || a.role}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setRecentMemberConfirmOpen(false); setPendingMember(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => handleAddMember(true)}
                    data-testid="confirm-recent-member-btn"
                  >
                    Assign Anyway
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          </CardHeader>
          <CardContent>
            {service.assignments?.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Users className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={40} />
                <p>No team members assigned yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {service.assignments?.map((assignment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700"
                    data-testid={`assignment-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getRoleColor(assignment.role)}`}>
                        {assignment.role}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">{assignment.member_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {canEdit() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          onClick={() => handleNotifyMember(assignment.member_id, assignment.member_name)}
                          disabled={notifyingMemberId === assignment.member_id}
                          title={`Send reminder to ${assignment.member_name}`}
                          data-testid={`notify-member-${index}`}
                        >
                          {notifyingMemberId === assignment.member_id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Bell size={16} />
                          )}
                        </Button>
                      )}
                      {canRequestSwap(assignment) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-900/20"
                          onClick={() => openSwapDialog(assignment)}
                          data-testid={`swap-assignment-${index}`}
                        >
                          <ArrowLeftRight size={14} className="mr-1" /> Swap
                        </Button>
                      )}
                      {canEdit() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => handleRemoveMember(index)}
                          data-testid={`remove-assignment-${index}`}
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Song Slots */}
        <Card className="border-0 shadow-sm" data-testid="song-slots-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2 dark:text-white">
              <Music size={20} className="text-amber-600 dark:text-amber-400" /> Song List
            </CardTitle>
            {canEdit() && (
            <Dialog open={songDialogOpen} onOpenChange={(open) => {
              setSongDialogOpen(open);
              if (!open) {
                setSongSearch("");
                setSelectedSong("");
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 rounded-full" data-testid="add-song-slot-btn">
                  <Plus size={16} className="mr-1" /> Add Song
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="dark:text-white">Add Song to Service</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4 flex-1 overflow-hidden flex flex-col">
                  <div>
                    <Label className="dark:text-slate-300">Search Song</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input
                        placeholder="Type to search songs..."
                        value={songSearch}
                        onChange={(e) => setSongSearch(e.target.value)}
                        className="pl-9 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        data-testid="song-search-input"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0 max-h-60 border dark:border-slate-600 rounded-lg">
                    {getFilteredSongs().length === 0 ? (
                      <p className="text-center text-slate-500 dark:text-slate-400 py-4">No songs found</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {getFilteredSongs().map((s) => {
                          const lastUsed = getSongLastUsed(s.id);
                          const isSelected = selectedSong === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSong(s.id)}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                                isSelected ? "bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500" : ""
                              } ${lastUsed.isRecent ? "text-red-600" : ""}`}
                              data-testid={`song-option-${s.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className={`font-medium ${lastUsed.isRecent ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
                                    {s.title}
                                  </span>
                                  {s.artist && <span className="text-slate-500 dark:text-slate-400 text-sm ml-2">- {s.artist}</span>}
                                  {s.key && <span className="text-slate-400 text-xs ml-2">({s.key})</span>}
                                </div>
                                {lastUsed.isRecent && (
                                  <span className="text-red-500 text-xs flex items-center gap-1">
                                    <AlertTriangle size={12} /> Used recently
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-red-600">⚠️ Red songs</span> were used in the last month
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setSongDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      className="bg-amber-600 hover:bg-amber-700" 
                      onClick={() => handleAddSong(false)} 
                      disabled={!selectedSong}
                      data-testid="confirm-add-song-btn"
                    >
                      Add Song
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            )}

            {/* Recent Song Confirmation Dialog */}
            <Dialog open={recentSongConfirmOpen} onOpenChange={setRecentSongConfirmOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle size={20} /> Song Recently Used
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-slate-600 dark:text-slate-400">
                    This song was used within the last month. Are you sure you want to add it again?
                  </p>
                  {pendingSong && (() => {
                    const song = songs.find(s => s.id === pendingSong);
                    const lastUsed = getSongLastUsed(pendingSong);
                    return (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="font-medium text-slate-900 dark:text-white">{song?.title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Last used: {lastUsed.serviceName} ({new Date(lastUsed.date).toLocaleDateString()})
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setRecentSongConfirmOpen(false); setPendingSong(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => handleAddSong(true)}
                    data-testid="confirm-recent-song-btn"
                  >
                    Add Anyway
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {service.song_slots?.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Music className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={40} />
                <p>No songs added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {canEdit() && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                    {isMobile ? (
                      <>Use arrows to reorder songs</>
                    ) : (
                      <><GripVertical size={12} /> Drag songs to reorder</>
                    )}
                  </p>
                )}
                {service.song_slots?.map((slot, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700 transition-all ${
                      canEdit() && !isMobile ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${draggedSongIndex === index ? 'opacity-50 scale-95' : ''}`}
                    draggable={canEdit() && !isMobile}
                    onDragStart={(e) => canEdit() && !isMobile && handleDragStart(e, index)}
                    onDragOver={(e) => canEdit() && !isMobile && handleDragOver(e, index)}
                    onDrop={(e) => canEdit() && !isMobile && handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    data-testid={`song-slot-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      {canEdit() && !isMobile && (
                        <GripVertical size={16} className="text-slate-400 flex-shrink-0" />
                      )}
                      {canEdit() && isMobile && (
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            onClick={() => moveSong(index, 'up')}
                            disabled={index === 0}
                            data-testid={`move-song-up-${index}`}
                          >
                            <ChevronUp size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            onClick={() => moveSong(index, 'down')}
                            disabled={index === service.song_slots.length - 1}
                            data-testid={`move-song-down-${index}`}
                          >
                            <ChevronDown size={14} />
                          </Button>
                        </div>
                      )}
                      <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {slot.order}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">{slot.song_title}</span>
                    </div>
                    {canEdit() && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600 flex-shrink-0"
                      onClick={() => handleRemoveSong(index)}
                      data-testid={`remove-song-${index}`}
                    >
                      <X size={16} />
                    </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {service.notes && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg dark:text-white">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-400">{service.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Notify Team Confirmation Dialog */}
      <Dialog open={notifyConfirmOpen} onOpenChange={setNotifyConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Mail className="text-blue-600" size={20} /> Notify Team Members
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-slate-600 dark:text-slate-300">
              This will send an email notification to all {service?.assignments?.length || 0} assigned team member(s) with their service details and role.
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Service:</strong> {service?.title || `${service?.day} Service`}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Date:</strong> {service?.date && format(parseISO(service.date), "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Time:</strong> {service?.time}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotifyConfirmOpen(false)} data-testid="notify-cancel-btn">
                Cancel
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleNotifyTeam}
                disabled={notifyLoading}
                data-testid="notify-confirm-btn"
              >
                {notifyLoading ? (
                  <>
                    <Loader2 size={16} className="mr-1 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} className="mr-1" /> Send Notifications
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify All (Announcement) Confirmation Dialog */}
      <Dialog open={notifyAllConfirmOpen} onOpenChange={setNotifyAllConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Megaphone className="text-purple-600" size={20} /> Announce to Everyone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-slate-600 dark:text-slate-300">
              This will send an email announcement to <strong>ALL</strong> team members ({members?.length || 0} people) with the service details, team assignments, and song list.
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Service:</strong> {service?.title || `${service?.day} Service`}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Date:</strong> {service?.date && format(parseISO(service.date), "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Time:</strong> {service?.time}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <p className="text-sm text-purple-800 dark:text-purple-300">
                <strong>Note:</strong> Use this to announce a service to the whole team. To notify only assigned members, use the Notify Team button instead.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotifyAllConfirmOpen(false)} data-testid="notify-all-cancel-btn">
                Cancel
              </Button>
              <Button 
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleNotifyAll}
                disabled={notifyAllLoading}
                data-testid="notify-all-confirm-btn"
              >
                {notifyAllLoading ? (
                  <>
                    <Loader2 size={16} className="mr-1 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Megaphone size={16} className="mr-1" /> Send Announcement
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Confirmation Dialog (for members) */}
      <Dialog open={swapConfirmOpen} onOpenChange={setSwapConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-600" size={20} /> Confirm Swap Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-slate-600 dark:text-slate-300">
              Before you request to swap, can you confirm that you have spoken to admin?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSwapConfirmOpen(false)} data-testid="swap-confirm-cancel">
                Cancel
              </Button>
              <Button 
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={proceedToSwapDialog}
                data-testid="swap-confirm-proceed"
              >
                Yes, I have spoken to admin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Request Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="text-amber-600" size={20} /> Request Swap
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Member:</strong> {swapAssignment?.member_name}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Role:</strong> {ROLES.find(r => r.id === swapAssignment?.role)?.label || swapAssignment?.role}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Service: {service?.title || `${service?.day} Service`} - {service?.date && format(parseISO(service.date), "MMM d, yyyy")}
              </p>
            </div>

            <div>
              <Label className="dark:text-slate-300">Reason for Swap Request *</Label>
              <Textarea
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="Please provide a reason for this swap request..."
                className="mt-1 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                rows={3}
                data-testid="swap-reason-input"
              />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              This request will be sent to the admin for approval. They will select a replacement member.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleSwapRequest}
                disabled={!swapReason.trim()}
                data-testid="submit-swap-request-btn"
              >
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

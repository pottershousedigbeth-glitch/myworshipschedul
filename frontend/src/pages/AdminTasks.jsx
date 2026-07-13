import { useEffect, useState } from "react";
import { ClipboardList, Plus, Calendar, User, Clock, AlertTriangle, CheckCircle2, Circle, Loader2, Trash2, Edit2, X, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminTasks() {
  const { user, isMasterAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "everyone",
    assigned_to_name: "Everyone",
    due_date: "",
    priority: "medium",
    repeat: "none"
  });

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin-tasks`, { headers }),
        axios.get(`${API}/admin-tasks/stats/summary`, { headers }),
        isMasterAdmin() ? axios.get(`${API}/users`, { headers }) : Promise.resolve({ data: [] })
      ]);
      setTasks(tasksRes.data);
      setStats(statsRes.data);
      // Filter to only admins
      const adminUsers = usersRes.data.filter(u => u.role === "admin" || u.role === "master_admin");
      setAdmins(adminUsers);
    } catch (error) {
      toast.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (task = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || "",
        assigned_to: task.assigned_to,
        assigned_to_name: task.assigned_to_name,
        due_date: task.due_date,
        priority: task.priority,
        repeat: task.repeat || "none"
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: "",
        description: "",
        assigned_to: "everyone",
        assigned_to_name: "Everyone",
        due_date: new Date().toISOString().split("T")[0],
        priority: "medium",
        repeat: "none"
      });
    }
    setDialogOpen(true);
  };

  const handleAssigneeChange = (value) => {
    if (value === "everyone") {
      setFormData({ ...formData, assigned_to: "everyone", assigned_to_name: "Everyone" });
    } else {
      const admin = admins.find(a => a.id === value);
      setFormData({ 
        ...formData, 
        assigned_to: value, 
        assigned_to_name: admin?.name || "Unknown" 
      });
    }
  };

  const handleSaveTask = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    if (!formData.due_date) {
      toast.error("Please select a due date");
      return;
    }

    setSaving(true);
    try {
      if (editingTask) {
        await axios.put(`${API}/admin-tasks/${editingTask.id}`, formData, { headers });
        toast.success("Task updated");
      } else {
        await axios.post(`${API}/admin-tasks`, formData, { headers });
        toast.success("Task created");
      }
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.put(`${API}/admin-tasks/${taskId}`, { status: newStatus }, { headers });
      toast.success(`Task marked as ${newStatus.replace("_", " ")}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update task status");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await axios.delete(`${API}/admin-tasks/${taskId}`, { headers });
      toast.success("Task deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "medium": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case "low": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed": return <CheckCircle2 size={18} className="text-green-500" />;
      case "in_progress": return <Clock size={18} className="text-amber-500" />;
      default: return <Circle size={18} className="text-slate-400" />;
    }
  };

  const isOverdue = (task) => {
    if (task.status === "completed") return false;
    return task.due_date < new Date().toISOString().split("T")[0];
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === "all") return true;
    if (filter === "overdue") return isOverdue(task);
    return task.status === filter;
  });

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric", 
        year: "numeric" 
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-tasks-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Tasks</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and track admin assignments</p>
        </div>
        {isMasterAdmin() && (
          <Button 
            onClick={() => handleOpenDialog()} 
            className="bg-amber-600 hover:bg-amber-700"
            data-testid="create-task-btn"
          >
            <Plus size={18} className="mr-2" /> New Task
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.in_progress}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Overdue</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["all", "pending", "in_progress", "completed", "overdue"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-amber-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
            <ClipboardList size={20} className="text-amber-600" />
            Tasks ({filteredTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              {filter === "all" ? "No tasks yet. Create one to get started!" : `No ${filter.replace("_", " ")} tasks.`}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border ${
                    isOverdue(task) 
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20" 
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  }`}
                  data-testid={`task-${task.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => {
                          const nextStatus = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
                          handleStatusChange(task.id, nextStatus);
                        }}
                        className="mt-1"
                        title="Click to change status"
                      >
                        {getStatusIcon(task.status)}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-medium ${task.status === "completed" ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                            {task.title}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          {task.repeat === "weekly" && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                              <Repeat size={12} /> Weekly
                            </span>
                          )}
                          {isOverdue(task) && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
                              <AlertTriangle size={12} /> Overdue
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <User size={12} /> {task.assigned_to_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> Due: {formatDate(task.due_date)}
                          </span>
                          {task.completed_at && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 size={12} /> Completed by {task.completed_by}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isMasterAdmin() && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-amber-600"
                          onClick={() => handleOpenDialog(task)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              {editingTask ? "Edit Task" : "Create New Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
                data-testid="task-title-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description (optional)"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Assign To *</label>
              <Select value={formData.assigned_to} onValueChange={handleAssigneeChange}>
                <SelectTrigger data-testid="task-assignee-select">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">
                    <span className="flex items-center gap-2">
                      Everyone (All Admins)
                    </span>
                  </SelectItem>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      <span className="flex items-center gap-2">
                        {admin.name}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          admin.role === "master_admin" 
                            ? "bg-purple-100 text-purple-700" 
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {admin.role === "master_admin" ? "Master" : "Admin"}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Due Date *</label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                data-testid="task-due-date-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Priority</label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Repeat</label>
              <Select value={formData.repeat} onValueChange={(v) => setFormData({ ...formData, repeat: v })}>
                <SelectTrigger data-testid="task-repeat-select">
                  <SelectValue placeholder="Select repeat option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Repeat (One-time)</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              {formData.repeat === "weekly" && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Task will repeat every week on the same day. A new task is created when completed.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveTask} 
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="save-task-btn"
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {editingTask ? "Update Task" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

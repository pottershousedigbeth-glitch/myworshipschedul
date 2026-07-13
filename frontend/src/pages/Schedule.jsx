import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Users, Music, Archive, ArchiveRestore, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Schedule() {
  const { canEdit } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    day: "Sunday",
    time: "10:00 AM",
    title: "",
    notes: "",
  });

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchServices = async () => {
    try {
      const res = await axios.get(`${API}/services`);
      setServices(res.data);
    } catch (error) {
      toast.error("Failed to fetch services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleArchiveService = async (serviceId, currentArchived) => {
    try {
      await axios.post(`${API}/services/${serviceId}/archive`, {}, { headers });
      toast.success(currentArchived ? "Service unarchived" : "Service archived");
      fetchServices();
    } catch (error) {
      toast.error("Failed to update service");
    }
  };

  // Filter services based on archive status
  const filteredServices = services.filter(s => showArchived ? s.archived : !s.archived);
  const archivedCount = services.filter(s => s.archived).length;

  const handleDateSelect = (date) => {
    if (!date) return;
    const dayOfWeek = getDay(date);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    setSelectedDate(date);
    setFormData({
      ...formData,
      date: format(date, "yyyy-MM-dd"),
      day: dayNames[dayOfWeek],
    });
    setCalendarOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date) {
      toast.error("Please select a date");
      return;
    }

    try {
      await axios.post(`${API}/services`, formData);
      toast.success("Service scheduled!");
      setDialogOpen(false);
      resetForm();
      fetchServices();
    } catch (error) {
      toast.error("Failed to schedule service");
    }
  };

  const resetForm = () => {
    setSelectedDate(null);
    setCalendarOpen(false);
    setFormData({ date: "", day: "Sunday", time: "10:00 AM", title: "", notes: "" });
  };

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const getServiceForDate = (date) => {
    return services.find(s => isSameDay(parseISO(s.date), date));
  };

  // Get start padding for calendar
  const startDay = getDay(monthStart);
  const paddingDays = Array(startDay).fill(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6" data-testid="schedule-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Schedule</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Plan your worship services</p>
        </div>
        {canEdit() && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700 rounded-full" data-testid="schedule-service-btn">
              <Plus size={18} className="mr-2" /> Schedule Service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="dark:text-white">Schedule Service</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label className="dark:text-slate-300">Date *</Label>
                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full justify-start text-left font-normal mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                  data-testid="date-picker-btn"
                  onClick={() => setCalendarOpen(!calendarOpen)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
                {calendarOpen && (
                  <div className="mt-2 border rounded-lg p-2 bg-white dark:bg-slate-800 dark:border-slate-600 shadow-lg">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="day">Day</Label>
                  <Select value={formData.day} onValueChange={(val) => setFormData({ ...formData, day: val })}>
                    <SelectTrigger className="mt-1" data-testid="day-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    placeholder="e.g., 10:00 AM"
                    className="mt-1"
                    data-testid="time-input"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Easter Sunday Service"
                  className="mt-1"
                  data-testid="service-title-input"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes"
                  className="mt-1"
                  data-testid="service-notes-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="cancel-service-btn">
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" data-testid="save-service-btn">
                  Schedule
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Calendar View */}
      <Card className="border-0 shadow-sm" data-testid="calendar-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl dark:text-white">{format(currentMonth, "MMMM yyyy")}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              data-testid="prev-month-btn"
            >
              <ChevronLeft size={18} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              data-testid="next-month-btn"
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {paddingDays.map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {daysInMonth.map((day) => {
              const service = getServiceForDate(day);
              const isToday = isSameDay(day, new Date());
              const isSunday = getDay(day) === 0;
              const isWednesday = getDay(day) === 3;
              
              return (
                <div
                  key={day.toISOString()}
                  className={`aspect-square p-1 rounded-lg transition-colors ${
                    isToday ? "bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-500" : ""
                  } ${(isSunday || isWednesday) && !service ? "bg-slate-50 dark:bg-slate-700/50" : ""}`}
                >
                  <div className="h-full flex flex-col">
                    <span className={`text-sm ${
                      isToday ? "font-bold text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"
                    }`}>
                      {format(day, "d")}
                    </span>
                    {service && (
                      <Link
                        to={`/service/${service.id}`}
                        className="flex-1 mt-1"
                        data-testid={`calendar-service-${service.id}`}
                      >
                        <div className="h-full bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/50 rounded p-1 transition-colors cursor-pointer">
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 truncate">
                            {service.title || service.day}
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 truncate">{service.time}</p>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      <Card className="border-0 shadow-sm" data-testid="services-list-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl dark:text-white">
            {showArchived ? "Archived Services" : "All Services"}
          </CardTitle>
          {canEdit() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2"
              data-testid="toggle-archived-btn"
            >
              {showArchived ? (
                <>
                  <Eye size={16} /> Show Active ({services.length - archivedCount})
                </>
              ) : (
                <>
                  <Archive size={16} /> View Archived ({archivedCount})
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <CalendarIcon className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={40} />
              <p>{showArchived ? "No archived services" : "No services scheduled yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServices
                .sort((a, b) => showArchived ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
                .map((service) => (
                  <div key={service.id} className="flex items-center gap-2">
                    <Link to={`/service/${service.id}`} className="flex-1" data-testid={`service-item-${service.id}`}>
                      <div className={`flex items-center justify-between p-4 rounded-xl ${
                        service.archived 
                          ? 'bg-slate-100 dark:bg-slate-800 opacity-75' 
                          : 'bg-slate-50 dark:bg-slate-700'
                      } hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer`}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex flex-col items-center justify-center">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                              {format(parseISO(service.date), "MMM")}
                            </span>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">
                              {format(parseISO(service.date), "d")}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                              {service.title || `${service.day} Service`}
                              {service.archived && (
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                                  Archived
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock size={14} /> {service.time}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={14} /> {service.assignments?.length || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Music size={14} /> {service.song_slots?.length || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium">
                          {service.day}
                        </span>
                      </div>
                    </Link>
                    {canEdit() && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-10 w-10 flex-shrink-0 ${
                          service.archived 
                            ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleArchiveService(service.id, service.archived);
                        }}
                        title={service.archived ? "Unarchive service" : "Archive service"}
                        data-testid={`archive-service-${service.id}`}
                      >
                        {service.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

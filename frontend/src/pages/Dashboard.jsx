import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Users, Music, ArrowRight, Clock, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const roleColors = {
  singer: "bg-purple-100 text-purple-700",
  bass: "bg-blue-100 text-blue-700",
  guitarist: "bg-amber-100 text-amber-700",
  keyboard: "bg-emerald-100 text-emerald-700",
  drummer: "bg-rose-100 text-rose-700",
};

const userRoleColors = {
  master_admin: "text-purple-600",
  admin: "text-blue-600",
  member: "text-slate-600",
};

export default function Dashboard() {
  const { canEdit } = useAuth();
  const [stats, setStats] = useState({ team_members: 0, songs: 0, upcoming_services: 0 });
  const [upcomingServices, setUpcomingServices] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({ online_count: 0, users: [] });
  const [loading, setLoading] = useState(true);

  const fetchOnlineUsers = async () => {
    try {
      const res = await axios.get(`${API}/users/online`);
      setOnlineUsers(res.data);
    } catch (error) {
      console.error("Error fetching online users:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, servicesRes, onlineRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/services/upcoming/list`),
          axios.get(`${API}/users/online`),
        ]);
        setStats(statsRes.data);
        setUpcomingServices(servicesRes.data.slice(0, 3));
        setOnlineUsers(onlineRes.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Refresh online users every 30 seconds
    const interval = setInterval(fetchOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: "Team Members", value: stats.team_members, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Songs", value: stats.songs, icon: Music, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Upcoming Services", value: stats.upcoming_services, icon: Calendar, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-8" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Welcome to your worship team management hub</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.label} className="card-hover border-0 shadow-sm" data-testid={`stat-${stat.label.toLowerCase().replace(/ /g, '-')}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg} dark:bg-slate-700`}>
                  <stat.icon className={`${stat.color} dark:text-white`} size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {/* Online Users Card */}
        <Card className="card-hover border-0 shadow-sm" data-testid="stat-online-users">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Online Now</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{onlineUsers.online_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 dark:bg-slate-700">
                <Wifi className="text-green-600 dark:text-green-400" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online Users List */}
      {onlineUsers.users.length > 0 && (
        <Card className="border-0 shadow-sm" data-testid="online-users-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Online Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {onlineUsers.users.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-full"
                  data-testid={`online-user-${user.id}`}
                >
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className={`text-sm font-medium dark:text-white ${userRoleColors[user.role] || 'text-slate-600'}`}>
                    {user.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Services */}
      <Card className="border-0 shadow-sm" data-testid="upcoming-services-card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">Upcoming Services</CardTitle>
          <Link to="/schedule">
            <Button variant="ghost" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-slate-700" data-testid="view-all-services-btn">
              View All <ArrowRight size={16} className="ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {upcomingServices.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Calendar className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={40} />
              <p>No upcoming services scheduled</p>
              <Link to="/schedule">
                <Button className="mt-4 bg-amber-600 hover:bg-amber-700" data-testid="schedule-service-btn">
                  {canEdit() ? "Schedule a Service" : "View Schedule"}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingServices.map((service) => (
                <Link key={service.id} to={`/service/${service.id}`} data-testid={`service-link-${service.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                          {format(parseISO(service.date), "MMM")}
                        </span>
                        <span className="text-xl font-bold text-slate-900 dark:text-white">
                          {format(parseISO(service.date), "d")}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {service.title || `${service.day} Service`}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <Clock size={14} />
                          <span>{service.time}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 dark:text-slate-300 text-xs">
                            {service.day}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {service.assignments?.length || 0} assigned
                      </span>
                      <ArrowRight size={16} className="text-slate-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/team" className="block">
          <Card className="card-hover border-0 shadow-sm cursor-pointer h-full" data-testid="quick-add-member">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-slate-700">
                <Users className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{canEdit() ? "Add Team Member" : "Team Members"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{canEdit() ? "Build your worship team" : "View your worship team"}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/songs" className="block">
          <Card className="card-hover border-0 shadow-sm cursor-pointer h-full" data-testid="quick-add-song">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-slate-700">
                <Music className="text-amber-600 dark:text-amber-400" size={24} />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{canEdit() ? "Add Song" : "Songs"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{canEdit() ? "Expand your library" : "View song library"}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/schedule" className="block">
          <Card className="card-hover border-0 shadow-sm cursor-pointer h-full" data-testid="quick-schedule">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-slate-700">
                <Calendar className="text-emerald-600 dark:text-emerald-400" size={24} />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{canEdit() ? "Schedule Service" : "Schedule"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{canEdit() ? "Plan upcoming worship" : "View upcoming services"}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

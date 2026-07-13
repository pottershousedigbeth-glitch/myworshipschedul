import { useEffect, useState } from "react";
import { BarChart3, Music, Users, Calendar, TrendingUp, Hash, LogIn, Clock, Bell, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Analytics() {
  const [songStats, setSongStats] = useState([]);
  const [memberStats, setMemberStats] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loginStats, setLoginStats] = useState(null);
  const [notificationLogs, setNotificationLogs] = useState([]);
  const [notificationStats, setNotificationStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("songs");

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [songsRes, membersRes, summaryRes, loginHistoryRes, loginStatsRes, notifLogsRes, notifStatsRes] = await Promise.all([
        axios.get(`${API}/analytics/songs`),
        axios.get(`${API}/analytics/team-members`),
        axios.get(`${API}/analytics/summary`),
        axios.get(`${API}/login-history?limit=50`),
        axios.get(`${API}/login-history/stats`),
        axios.get(`${API}/analytics/notifications?limit=50`).catch(() => ({ data: [] })),
        axios.get(`${API}/analytics/notifications/stats`).catch(() => ({ data: null }))
      ]);
      setSongStats(songsRes.data);
      setMemberStats(membersRes.data);
      setSummary(summaryRes.data);
      setLoginHistory(loginHistoryRes.data);
      setLoginStats(loginStatsRes.data);
      setNotificationLogs(notifLogsRes.data);
      setNotificationStats(notifStatsRes.data);
    } catch (error) {
      toast.error("Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const getRoleLabel = (role) => {
    const roles = {
      singer: "Singer",
      bass_guitarist: "Bass Guitarist",
      keyboard: "Keyboard",
      drummer: "Drummer",
      worship_leader: "Worship Leader",
    };
    return roles[role] || role;
  };

  const getUserRoleLabel = (role) => {
    const roles = {
      master_admin: "Master Admin",
      admin: "Admin",
      member: "Member",
    };
    return roles[role] || role;
  };

  const getUserRoleColor = (role) => {
    const colors = {
      master_admin: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
      admin: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      member: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    };
    return colors[role] || "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="text-amber-600" /> Analytics
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Track song usage and team member assignments</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-slate-700">
                  <Calendar className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total_services}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Services</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-slate-700">
                  <Music className="text-purple-600 dark:text-purple-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total_song_uses}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Song Uses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-slate-700">
                  <Users className="text-green-600 dark:text-green-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total_assignments}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Assignments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-slate-700">
                  <TrendingUp className="text-amber-600 dark:text-amber-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.avg_songs_per_service}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Avg Songs/Service</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab("songs")}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
            activeTab === "songs"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          data-testid="songs-tab"
        >
          <Music size={16} className="inline mr-2" />
          Song Usage
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
            activeTab === "members"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          data-testid="members-tab"
        >
          <Users size={16} className="inline mr-2" />
          Team Assignments
        </button>
        <button
          onClick={() => setActiveTab("logins")}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
            activeTab === "logins"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          data-testid="logins-tab"
        >
          <LogIn size={16} className="inline mr-2" />
          Login Activity
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
            activeTab === "notifications"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          data-testid="notifications-tab"
        >
          <Bell size={16} className="inline mr-2" />
          Notifications
        </button>
      </div>

      {/* Song Usage Tab */}
      {activeTab === "songs" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
              <Music size={20} className="text-purple-600 dark:text-purple-400" /> Song Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {songStats.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">No song data available yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Song</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Artist</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Times Used</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Last Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {songStats.map((song) => (
                      <tr key={song.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900 dark:text-white">{song.title}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{song.artist || "-"}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                            song.usage_count > 0 
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" 
                              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          }`}>
                            <Hash size={12} />
                            {song.usage_count}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDate(song.last_used)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Members Tab */}
      {activeTab === "members" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
              <Users size={20} className="text-green-600 dark:text-green-400" /> Team Member Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memberStats.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">No team member data available yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Roles</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Times Assigned</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Role Breakdown</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Last Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberStats.map((member) => (
                      <tr key={member.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900 dark:text-white">{member.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {member.roles?.map((role) => (
                              <span key={role} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                                {getRoleLabel(role)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                            member.assignment_count > 0 
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" 
                              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          }`}>
                            <Hash size={12} />
                            {member.assignment_count}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(member.role_breakdown || {}).map(([role, count]) => (
                              <span key={role} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs">
                                {getRoleLabel(role)}: {count}
                              </span>
                            ))}
                            {Object.keys(member.role_breakdown || {}).length === 0 && (
                              <span className="text-slate-400 dark:text-slate-500 text-sm">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDate(member.last_assigned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Login Activity Tab */}
      {activeTab === "logins" && (
        <>
          {/* Login Stats Cards */}
          {loginStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-slate-700">
                      <LogIn className="text-green-600 dark:text-green-400" size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{loginStats.logins_last_24h}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Logins (24h)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-slate-700">
                      <Calendar className="text-blue-600 dark:text-blue-400" size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{loginStats.logins_last_7d}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Logins (7 days)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-slate-700">
                      <TrendingUp className="text-purple-600 dark:text-purple-400" size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{loginStats.total_logins}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Logins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* User Login Summary */}
          {loginStats?.users_login_count?.length > 0 && (
            <Card className="border-0 shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                  <Users size={20} className="text-blue-600 dark:text-blue-400" /> Login Summary by User
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">User</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Role</th>
                        <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Total Logins</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginStats.users_login_count.map((user) => (
                        <tr key={user.user_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{user.user_name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getUserRoleColor(user.user_role)}`}>
                              {getUserRoleLabel(user.user_role)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                              <Hash size={12} />
                              {user.login_count}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{getTimeAgo(user.last_login)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Login History */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                <Clock size={20} className="text-amber-600 dark:text-amber-400" /> Recent Login Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loginHistory.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No login history available yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">User</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Role</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Login Time</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Time Ago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map((login) => (
                        <tr key={login.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{login.user_name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{login.user_email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getUserRoleColor(login.user_role)}`}>
                              {getUserRoleLabel(login.user_role)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDateTime(login.login_at)}</td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-slate-500 dark:text-slate-400">{getTimeAgo(login.login_at)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <>
          {/* Notification Stats */}
          {notificationStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-slate-700">
                      <Bell className="text-amber-600 dark:text-amber-400" size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{notificationStats.total_notifications}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Sent</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-slate-700">
                      <Users className="text-blue-600 dark:text-blue-400" size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{notificationStats.total_recipients}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Recipients</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-slate-700">
                      <Send className="text-green-600 dark:text-green-400" size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{notificationStats.last_7_days}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Last 7 Days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-slate-700">
                      <Users className="text-purple-600 dark:text-purple-400" size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{Object.keys(notificationStats.by_sender || {}).length}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Active Senders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                <Bell size={20} className="text-amber-600 dark:text-amber-400" /> Notification History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notificationLogs.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No notifications sent yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Sent By</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Service</th>
                        <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Recipients</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-300">Sent At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificationLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.type === "announce" 
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                : log.type === "notify_team"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            }`}>
                              {log.type === "announce" ? "Announcement" : log.type === "notify_team" ? "Team Notify" : "Individual"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-900 dark:text-white">{log.sender_name}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{log.service_title || "Unknown Service"}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                              <Users size={12} />
                              {log.recipients_count}
                            </span>
                            {log.failed_recipients?.length > 0 && (
                              <span className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                ✗ {log.failed_recipients.length}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-600 dark:text-slate-400">{formatDateTime(log.sent_at)}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">{getTimeAgo(log.sent_at)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

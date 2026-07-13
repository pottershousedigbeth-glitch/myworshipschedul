import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Hand, Check, Clock, User, Calendar, X } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLES = [
  { id: "singer", label: "Singer" },
  { id: "bass", label: "Bass" },
  { id: "guitarist", label: "Guitarist" },
  { id: "keyboard", label: "Keyboard" },
  { id: "drummer", label: "Drummer" },
  { id: "worship_leader", label: "Worship Leader" },
];

export default function MySwapRequests() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("available");
  const [availableRequests, setAvailableRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [availableRes, myRes] = await Promise.all([
        axios.get(`${API}/swap-requests/available`, { headers }),
        axios.get(`${API}/swap-requests/my-requests`, { headers }),
      ]);
      setAvailableRequests(availableRes.data);
      setMyRequests(myRes.data);
    } catch (error) {
      console.error("Failed to fetch swap requests", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRoleLabel = (roleId) => {
    return ROLES.find(r => r.id === roleId)?.label || roleId;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      case "approved":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
      case "denied":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
      default:
        return "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const handleVolunteer = async (requestId) => {
    try {
      await axios.post(`${API}/swap-requests/${requestId}/volunteer`, {}, { headers });
      toast.success("You have volunteered for this swap! Admin will review shortly.");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to volunteer");
    }
  };

  const handleWithdraw = async (requestId) => {
    try {
      await axios.delete(`${API}/swap-requests/${requestId}/volunteer`, { headers });
      toast.success("Volunteer offer withdrawn");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to withdraw");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ArrowLeftRight className="text-amber-600" /> Swap Requests
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">View and volunteer for swap requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("available")}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === "available"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          data-testid="available-tab"
        >
          <Hand size={16} /> Available to Help
          {availableRequests.length > 0 && (
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
              {availableRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("my-requests")}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === "my-requests"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
          data-testid="my-requests-tab"
        >
          <Clock size={16} /> My Requests
          {myRequests.filter(r => r.status === "pending").length > 0 && (
            <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
              {myRequests.filter(r => r.status === "pending").length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      ) : (
        <>
          {/* Available to Help Tab */}
          {activeTab === "available" && (
            <div className="space-y-4">
              {availableRequests.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <Hand className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
                    <p className="text-slate-500 dark:text-slate-400">No swap requests need your help right now</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                      When team members request swaps for roles you can fill, they&apos;ll appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                availableRequests.map((request) => (
                  <Card key={request.id} className="border-0 shadow-sm" data-testid={`available-request-${request.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                              {getRoleLabel(request.role)} needed
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <User size={16} className="text-slate-400" />
                            <span className="font-medium">{request.member_name}</span>
                            <span className="text-slate-500 dark:text-slate-400">needs a swap</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Calendar size={14} />
                            <span>{request.service_title}</span>
                            <span>•</span>
                            <span>{formatDate(request.service_date)}</span>
                          </div>

                          <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              <strong>Reason:</strong> {request.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleVolunteer(request.id)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`volunteer-btn-${request.id}`}
                          >
                            <Hand size={16} className="mr-2" /> I Can Help
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* My Requests Tab */}
          {activeTab === "my-requests" && (
            <div className="space-y-4">
              {myRequests.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <Clock className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
                    <p className="text-slate-500 dark:text-slate-400">You haven&apos;t made any swap requests</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                      When you need to swap out of an assignment, request it from the service detail page
                    </p>
                  </CardContent>
                </Card>
              ) : (
                myRequests.map((request) => (
                  <Card key={request.id} className="border-0 shadow-sm" data-testid={`my-request-${request.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(request.status)}`}>
                              {request.status}
                            </span>
                            <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                              {getRoleLabel(request.role)}
                            </span>
                            {request.volunteer_member_name && (
                              <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium flex items-center gap-1">
                                <Check size={12} /> {request.volunteer_member_name} volunteered
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Calendar size={14} />
                            <span>{request.service_title}</span>
                            <span>•</span>
                            <span>{formatDate(request.service_date)}</span>
                          </div>

                          <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              <strong>Reason:</strong> {request.reason}
                            </p>
                          </div>

                          {request.status === "approved" && request.replacement_member_name && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-sm text-green-700 dark:text-green-300">
                                <strong>Replaced by:</strong> {request.replacement_member_name}
                              </p>
                            </div>
                          )}

                          {request.status === "denied" && request.denial_reason && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                              <p className="text-sm text-red-600 dark:text-red-400">
                                <strong>Denial reason:</strong> {request.denial_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

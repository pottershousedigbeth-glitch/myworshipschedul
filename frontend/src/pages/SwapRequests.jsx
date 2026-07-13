import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight, Check, X, Clock, User, Calendar, AlertTriangle, Users } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLES = [
  { id: "singer", label: "Singer" },
  { id: "bass", label: "Bass" },
  { id: "guitarist", label: "Guitarist" },
  { id: "keyboard", label: "Keyboard" },
  { id: "drummer", label: "Drummer" },
  { id: "worship_leader", label: "Worship Leader" },
];

export default function SwapRequests() {
  const { canEdit, isMasterAdmin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [replacementMemberId, setReplacementMemberId] = useState("");
  const [denyReason, setDenyReason] = useState("");

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API}/swap-requests${filter ? `?status=${filter}` : ""}`, { headers });
      setRequests(res.data);
    } catch (error) {
      console.error("Failed to fetch swap requests", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API}/team-members`, { headers });
      setMembers(res.data);
    } catch (error) {
      console.error("Failed to fetch team members", error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchMembers();
  }, [filter]);

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

  const getAvailableReplacements = (request) => {
    if (!request) return [];
    // Filter members who have the required role and are not the one being swapped out
    return members
      .filter(m => 
        m.roles.includes(request.role) && 
        m.id !== request.member_id
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    // Pre-select volunteer if one exists
    setReplacementMemberId(request.volunteer_member_id || "");
    setApproveDialogOpen(true);
  };

  const handleDenyClick = (request) => {
    setSelectedRequest(request);
    setDenyReason("");
    setDenyDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !replacementMemberId) return;
    
    const replacementMember = members.find(m => m.id === replacementMemberId);
    if (!replacementMember) return;

    try {
      await axios.put(
        `${API}/swap-requests/${selectedRequest.id}/approve`,
        {
          replacement_member_id: replacementMemberId,
          replacement_member_name: replacementMember.name
        },
        { headers }
      );
      setApproveDialogOpen(false);
      fetchRequests();
    } catch (error) {
      console.error("Failed to approve swap request", error);
      alert(error.response?.data?.detail || "Failed to approve swap request");
    }
  };

  const handleDeny = async () => {
    if (!selectedRequest) return;

    try {
      await axios.put(
        `${API}/swap-requests/${selectedRequest.id}/deny`,
        { reason: denyReason },
        { headers }
      );
      setDenyDialogOpen(false);
      fetchRequests();
    } catch (error) {
      console.error("Failed to deny swap request", error);
      alert(error.response?.data?.detail || "Failed to deny swap request");
    }
  };

  const handleDelete = async (requestId) => {
    if (!window.confirm("Are you sure you want to delete this swap request?")) return;
    
    try {
      await axios.delete(`${API}/swap-requests/${requestId}`, { headers });
      fetchRequests();
    } catch (error) {
      console.error("Failed to delete swap request", error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  if (!canEdit()) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="text-amber-600" /> Swap Requests
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage team member swap requests</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {["pending", "approved", "denied", ""].map((status) => (
          <button
            key={status || "all"}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === status
                ? "text-amber-600 border-b-2 border-amber-600"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
            data-testid={`filter-${status || "all"}`}
          >
            {status === "" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ArrowLeftRight className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
            <p className="text-slate-500 dark:text-slate-400">No swap requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id} className="border-0 shadow-sm" data-testid={`swap-request-${request.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Request Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(request.status)}`}>
                        {request.status}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                        {getRoleLabel(request.role)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <User size={16} className="text-slate-400" />
                      <span className="font-medium">{request.member_name}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {request.replacement_member_name || "Awaiting replacement"}
                      </span>
                    </div>

                    {/* Volunteer Info */}
                    {request.volunteer_member_name && !request.replacement_member_name && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                          <Users size={14} />
                          <strong>{request.volunteer_member_name}</strong> has volunteered to take this role!
                        </p>
                      </div>
                    )}

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

                    {request.denial_reason && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400">
                          <strong>Denial reason:</strong> {request.denial_reason}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Requested by {request.created_by_name}</span>
                      <span>•</span>
                      <span>{formatDateTime(request.created_at)}</span>
                      {request.reviewed_by_name && (
                        <>
                          <span>•</span>
                          <span>Reviewed by {request.reviewed_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {request.status === "pending" && isMasterAdmin() && (
                    <div className="flex gap-2 md:flex-col">
                      <Button
                        onClick={() => handleApproveClick(request)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                        data-testid={`approve-btn-${request.id}`}
                      >
                        <Check size={16} className="mr-1" /> Approve
                      </Button>
                      <Button
                        onClick={() => handleDenyClick(request)}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                        size="sm"
                        data-testid={`deny-btn-${request.id}`}
                      >
                        <X size={16} className="mr-1" /> Deny
                      </Button>
                    </div>
                  )}

                  {request.status !== "pending" && isMasterAdmin() && (
                    <Button
                      onClick={() => handleDelete(request.id)}
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-600"
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Check className="text-green-600" size={20} /> Approve Swap Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Original:</strong> {selectedRequest?.member_name} as {getRoleLabel(selectedRequest?.role)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Service: {selectedRequest?.service_title} - {formatDate(selectedRequest?.service_date)}
              </p>
            </div>

            <div>
              <Label className="dark:text-slate-300">Select Replacement Member *</Label>
              <Select value={replacementMemberId} onValueChange={setReplacementMemberId}>
                <SelectTrigger className="mt-1" data-testid="replacement-member-select">
                  <SelectValue placeholder="Choose a replacement" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableReplacements(selectedRequest).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Only members with the &quot;{getRoleLabel(selectedRequest?.role)}&quot; role are shown
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={!replacementMemberId}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="confirm-approve-btn"
              >
                Approve & Replace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <X className="text-red-600" size={20} /> Deny Swap Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>Request:</strong> {selectedRequest?.member_name} wants to swap out of {getRoleLabel(selectedRequest?.role)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Reason: {selectedRequest?.reason}
              </p>
            </div>

            <div>
              <Label className="dark:text-slate-300">Denial Reason (Optional)</Label>
              <Input
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Provide a reason for denial..."
                className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                data-testid="deny-reason-input"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDeny}
                className="bg-red-600 hover:bg-red-700 text-white"
                data-testid="confirm-deny-btn"
              >
                Deny Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Plus, Search, Lightbulb, Check, X, Trash2, ExternalLink, Clock, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700" },
};

export default function SongSuggestions() {
  const { user, canEdit } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSuggestionId, setDeletingSuggestionId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    youtube_link: "",
    notes: "",
  });

  const fetchSuggestions = async () => {
    try {
      const res = await axios.get(`${API}/song-suggestions`);
      setSuggestions(res.data);
    } catch (error) {
      toast.error("Failed to fetch suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Song title is required");
      return;
    }

    try {
      await axios.post(`${API}/song-suggestions`, formData);
      toast.success("Song suggestion submitted!");
      setDialogOpen(false);
      resetForm();
      fetchSuggestions();
    } catch (error) {
      toast.error("Failed to submit suggestion");
    }
  };

  const handleApprove = async (id) => {
    try {
      await axios.put(`${API}/song-suggestions/${id}/approve`);
      toast.success("Song approved and added to library!");
      fetchSuggestions();
    } catch (error) {
      toast.error("Failed to approve suggestion");
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.put(`${API}/song-suggestions/${id}/reject`);
      toast.success("Song suggestion rejected");
      fetchSuggestions();
    } catch (error) {
      toast.error("Failed to reject suggestion");
    }
  };

  const handleReset = async (id) => {
    try {
      await axios.put(`${API}/song-suggestions/${id}/reset`);
      toast.success("Suggestion moved back to pending");
      fetchSuggestions();
    } catch (error) {
      toast.error("Failed to reset suggestion");
    }
  };

  const handleDelete = async () => {
    if (!deletingSuggestionId) return;
    try {
      await axios.delete(`${API}/song-suggestions/${deletingSuggestionId}`);
      toast.success("Suggestion deleted");
      setDeleteDialogOpen(false);
      setDeletingSuggestionId(null);
      fetchSuggestions();
    } catch (error) {
      toast.error("Failed to delete suggestion");
    }
  };

  const resetForm = () => {
    setFormData({ title: "", artist: "", youtube_link: "", notes: "" });
  };

  const pendingSuggestions = suggestions.filter(s => s.status === "pending");
  const approvedSuggestions = suggestions.filter(s => s.status === "approved");
  const rejectedSuggestions = suggestions.filter(s => s.status === "rejected");

  const filterSuggestions = (list) => {
    return list.filter(s =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.artist && s.artist.toLowerCase().includes(search.toLowerCase())) ||
      s.suggested_by_name.toLowerCase().includes(search.toLowerCase())
    );
  };

  const renderSuggestionCard = (suggestion) => {
    const status = statusConfig[suggestion.status];
    const StatusIcon = status.icon;
    const canDelete = suggestion.suggested_by_id === user?.id || canEdit();

    return (
      <Card key={suggestion.id} className="card-hover border-0 shadow-sm" data-testid={`suggestion-card-${suggestion.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">{suggestion.title}</h3>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                  <StatusIcon size={12} /> {status.label}
                </span>
              </div>
              {suggestion.artist && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{suggestion.artist}</p>
              )}
            </div>
          </div>

          {suggestion.youtube_link && (
            <a
              href={suggestion.youtube_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-3"
            >
              <ExternalLink size={14} /> Listen on YouTube
            </a>
          )}

          {suggestion.notes && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{suggestion.notes}</p>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Suggested by <span className="font-medium">{suggestion.suggested_by_name}</span>
            </p>
            
            <div className="flex gap-2">
              {suggestion.status === "pending" && canEdit() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApprove(suggestion.id)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    data-testid={`approve-${suggestion.id}`}
                  >
                    <Check size={14} className="mr-1" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReject(suggestion.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`reject-${suggestion.id}`}
                  >
                    <X size={14} className="mr-1" /> Reject
                  </Button>
                </>
              )}
              {(suggestion.status === "approved" || suggestion.status === "rejected") && canEdit() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReset(suggestion.id)}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  data-testid={`reset-${suggestion.id}`}
                >
                  <RotateCcw size={14} className="mr-1" /> Move to Pending
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDeletingSuggestionId(suggestion.id); setDeleteDialogOpen(true); }}
                  className="text-slate-600 hover:text-red-600 hover:bg-red-50"
                  data-testid={`delete-suggestion-${suggestion.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  // Member view - only show suggestion form, not the list
  if (!canEdit()) {
    return (
      <div className="page-container space-y-6" data-testid="suggestions-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Song Suggestions</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Suggest new songs for worship</p>
          </div>
        </div>

        {/* Member Suggestion Card */}
        <Card className="border-0 shadow-sm max-w-xl">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Lightbulb className="mx-auto mb-3 text-amber-500" size={48} />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Have a Song in Mind?</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Suggest a song for the worship team to consider. Your suggestion will be reviewed by the admin.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title" className="dark:text-slate-300">Song Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter song title"
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-title-input"
                />
              </div>
              <div>
                <Label htmlFor="artist" className="dark:text-slate-300">Artist/Composer</Label>
                <Input
                  id="artist"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  placeholder="Artist name"
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-artist-input"
                />
              </div>
              <div>
                <Label htmlFor="youtube_link" className="dark:text-slate-300">YouTube Link (optional)</Label>
                <Input
                  id="youtube_link"
                  value={formData.youtube_link}
                  onChange={(e) => setFormData({ ...formData, youtube_link: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-youtube-input"
                />
              </div>
              <div>
                <Label htmlFor="notes" className="dark:text-slate-300">Why are you suggesting this song?</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Share why you think this song would be great..."
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-notes-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={!formData.title.trim()}
                data-testid="submit-suggestion-btn"
              >
                <Lightbulb size={16} className="mr-2" /> Submit Suggestion
              </Button>
            </form>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
              Your suggestion will be reviewed by the worship team admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin view - full functionality
  return (
    <div className="page-container space-y-6" data-testid="suggestions-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Song Suggestions</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Suggest new songs for worship</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700 rounded-full" data-testid="suggest-song-btn">
              <Plus size={18} className="mr-2" /> Suggest Song
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="dark:text-white">Suggest a Song</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="title" className="dark:text-slate-300">Song Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter song title"
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-title-input"
                />
              </div>
              <div>
                <Label htmlFor="artist" className="dark:text-slate-300">Artist/Composer</Label>
                <Input
                  id="artist"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  placeholder="Artist name"
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-artist-input"
                />
              </div>
              <div>
                <Label htmlFor="youtube_link" className="dark:text-slate-300">YouTube Link (optional)</Label>
                <Input
                  id="youtube_link"
                  value={formData.youtube_link}
                  onChange={(e) => setFormData({ ...formData, youtube_link: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-youtube-input"
                />
              </div>
              <div>
                <Label htmlFor="notes" className="dark:text-slate-300">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Why you're suggesting this song"
                  className="mt-1 dark:bg-slate-800 dark:border-slate-600"
                  data-testid="suggestion-notes-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" data-testid="submit-suggestion-btn">
                  Submit Suggestion
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="dark:text-white">Delete Suggestion</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400 py-4">Are you sure you want to delete this suggestion?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              data-testid="confirm-delete-suggestion-btn"
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
          placeholder="Search by title, artist, or suggester..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 dark:bg-slate-800 dark:border-slate-600"
          data-testid="search-suggestions-input"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock size={16} /> Pending ({pendingSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle size={16} /> Approved ({approvedSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle size={16} /> Rejected ({rejectedSuggestions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {filterSuggestions(pendingSuggestions).length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <Lightbulb className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
                <p className="text-slate-500 dark:text-slate-400">No pending suggestions</p>
                <Button
                  className="mt-4 bg-amber-600 hover:bg-amber-700"
                  onClick={() => setDialogOpen(true)}
                >
                  Suggest a Song
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterSuggestions(pendingSuggestions).map(renderSuggestionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved">
          {filterSuggestions(approvedSuggestions).length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <CheckCircle className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
                <p className="text-slate-500 dark:text-slate-400">No approved suggestions yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterSuggestions(approvedSuggestions).map(renderSuggestionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {filterSuggestions(rejectedSuggestions).length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <XCircle className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
                <p className="text-slate-500 dark:text-slate-400">No rejected suggestions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterSuggestions(rejectedSuggestions).map(renderSuggestionCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

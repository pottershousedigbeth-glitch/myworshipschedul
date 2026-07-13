import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, Music, Hash, Upload, FileText, Image, X, Download } from "lucide-react";
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

const KEYS = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm"];

export default function Songs() {
  const { canEdit } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingSongId, setUploadingSongId] = useState(null);
  const [uploadingSong, setUploadingSong] = useState(null);
  const [lyricsFile, setLyricsFile] = useState(null);
  const [sheetMusicFile, setSheetMusicFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    key: "",
    tempo: "",
    notes: "",
  });

  const fetchSongs = async () => {
    try {
      const res = await axios.get(`${API}/songs`);
      setSongs(res.data);
      // Update the uploading song if dialog is open
      if (uploadingSongId) {
        const updatedSong = res.data.find(s => s.id === uploadingSongId);
        if (updatedSong) setUploadingSong(updatedSong);
      }
    } catch (error) {
      toast.error("Failed to fetch songs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Song title is required");
      return;
    }

    const payload = {
      ...formData,
      tempo: formData.tempo ? parseInt(formData.tempo) : null,
    };

    try {
      if (editingSong) {
        await axios.put(`${API}/songs/${editingSong.id}`, payload);
        toast.success("Song updated!");
      } else {
        await axios.post(`${API}/songs`, payload);
        toast.success("Song added!");
      }
      setDialogOpen(false);
      resetForm();
      fetchSongs();
    } catch (error) {
      toast.error("Failed to save song");
    }
  };

  const handleDelete = async () => {
    if (!deletingSongId) return;
    try {
      await axios.delete(`${API}/songs/${deletingSongId}`);
      toast.success("Song deleted");
      setDeleteDialogOpen(false);
      setDeletingSongId(null);
      fetchSongs();
    } catch (error) {
      toast.error("Failed to delete song");
    }
  };

  const openEditDialog = (song) => {
    setEditingSong(song);
    setFormData({
      title: song.title,
      artist: song.artist || "",
      key: song.key || "",
      tempo: song.tempo?.toString() || "",
      notes: song.notes || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingSong(null);
    setFormData({ title: "", artist: "", key: "", tempo: "", notes: "" });
  };

  const openUploadDialog = (song) => {
    setUploadingSongId(song.id);
    setUploadingSong(song);
    setLyricsFile(null);
    setSheetMusicFile(null);
    setUploadDialogOpen(true);
  };

  const handleFileUpload = async (file, fileType) => {
    if (!uploadingSongId) return;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_type", fileType);
    
    setUploading(true);
    try {
      await axios.post(`${API}/songs/${uploadingSongId}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`${fileType === "lyrics" ? "Lyrics" : "Sheet music"} uploaded!`);
      fetchSongs();
      // Update local state
      if (fileType === "lyrics") setLyricsFile(null);
      else setSheetMusicFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (songId, fileType) => {
    try {
      await axios.delete(`${API}/songs/${songId}/file/${fileType}`);
      toast.success("File deleted");
      fetchSongs();
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const getFileUrl = (path) => {
    if (!path) return null;
    return `${process.env.REACT_APP_BACKEND_URL}${path}`;
  };

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6" data-testid="songs-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Song Library</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your worship songs</p>
        </div>
        {canEdit() && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700 rounded-full" data-testid="add-song-btn">
              <Plus size={18} className="mr-2" /> Add Song
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="dark:text-white">{editingSong ? "Edit Song" : "Add Song"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="title" className="dark:text-slate-300">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Song title"
                  className="mt-1"
                  data-testid="song-title-input"
                />
              </div>
              <div>
                <Label htmlFor="artist" className="dark:text-slate-300">Artist/Composer</Label>
                <Input
                  id="artist"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  placeholder="Artist name"
                  className="mt-1"
                  data-testid="song-artist-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="key" className="dark:text-slate-300">Key</Label>
                  <Select value={formData.key} onValueChange={(val) => setFormData({ ...formData, key: val })}>
                    <SelectTrigger className="mt-1" data-testid="song-key-select">
                      <SelectValue placeholder="Select key" />
                    </SelectTrigger>
                    <SelectContent>
                      {KEYS.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tempo" className="dark:text-slate-300">Tempo (BPM)</Label>
                  <Input
                    id="tempo"
                    type="number"
                    value={formData.tempo}
                    onChange={(e) => setFormData({ ...formData, tempo: e.target.value })}
                    placeholder="120"
                    className="mt-1"
                    data-testid="song-tempo-input"
                  />
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
                  data-testid="song-notes-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="cancel-song-btn">
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" data-testid="save-song-btn">
                  {editingSong ? "Update" : "Add Song"}
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
            <DialogTitle className="dark:text-white">Delete Song</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400 py-4">Are you sure you want to delete this song? This action cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              data-testid="confirm-delete-song-btn"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Files Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Upload Files - {uploadingSong?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Lyrics File Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 dark:text-slate-300">
                <FileText size={16} /> Lyrics File (.txt)
              </Label>
              {uploadingSong?.lyrics_file ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <FileText size={18} className="text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300 flex-1">Lyrics uploaded</span>
                  <a 
                    href={getFileUrl(uploadingSong.lyrics_file)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    <Download size={16} />
                  </a>
                  <button
                    onClick={() => handleDeleteFile(uploadingSongId, "lyrics")}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".txt"
                    onChange={(e) => setLyricsFile(e.target.files?.[0] || null)}
                    className="flex-1 dark:bg-slate-800 dark:border-slate-600"
                    data-testid="lyrics-file-input"
                  />
                  {lyricsFile && (
                    <Button
                      onClick={() => handleFileUpload(lyricsFile, "lyrics")}
                      disabled={uploading}
                      className="bg-amber-600 hover:bg-amber-700"
                      data-testid="upload-lyrics-btn"
                    >
                      {uploading ? "..." : <Upload size={16} />}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Sheet Music/Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 dark:text-slate-300">
                <Image size={16} /> Sheet Music / Image (.jpg, .png, .pdf)
              </Label>
              {uploadingSong?.sheet_music_file ? (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Image size={18} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">Image/PDF uploaded</span>
                  <a 
                    href={getFileUrl(uploadingSong.sheet_music_file)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <Download size={16} />
                  </a>
                  <button
                    onClick={() => handleDeleteFile(uploadingSongId, "sheet_music")}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setSheetMusicFile(e.target.files?.[0] || null)}
                    className="flex-1 dark:bg-slate-800 dark:border-slate-600"
                    data-testid="sheet-music-file-input"
                  />
                  {sheetMusicFile && (
                    <Button
                      onClick={() => handleFileUpload(sheetMusicFile, "sheet_music")}
                      disabled={uploading}
                      className="bg-amber-600 hover:bg-amber-700"
                      data-testid="upload-sheet-music-btn"
                    >
                      {uploading ? "..." : <Upload size={16} />}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">Maximum file size: 5MB per file</p>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Search by title or artist..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
          data-testid="search-songs-input"
        />
      </div>

      {/* Songs Grid */}
      {filteredSongs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Music className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
            <p className="text-slate-500 dark:text-slate-400">No songs found</p>
            {canEdit() && (
            <Button
              className="mt-4 bg-amber-600 hover:bg-amber-700"
              onClick={() => setDialogOpen(true)}
              data-testid="add-first-song-btn"
            >
              Add Your First Song
            </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSongs.map((song) => (
            <Card key={song.id} className="card-hover border-0 shadow-sm" data-testid={`song-card-${song.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-slate-700 flex items-center justify-center">
                      <Music className="text-amber-600 dark:text-amber-400" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{song.title}</h3>
                      {song.artist && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{song.artist}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {song.key && (
                    <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                      Key: {song.key}
                    </span>
                  )}
                  {song.tempo && (
                    <span className="px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1">
                      <Hash size={12} /> {song.tempo} BPM
                    </span>
                  )}
                  {song.lyrics_file && (
                    <a 
                      href={getFileUrl(song.lyrics_file)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium flex items-center gap-1 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                    >
                      <FileText size={12} /> Lyrics
                    </a>
                  )}
                  {song.sheet_music_file && (
                    <a 
                      href={getFileUrl(song.sheet_music_file)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium flex items-center gap-1 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                    >
                      <Image size={12} /> Sheet
                    </a>
                  )}
                </div>
                {song.notes && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{song.notes}</p>
                )}
                {canEdit() && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openUploadDialog(song)}
                    className="flex-1"
                    data-testid={`upload-song-${song.id}`}
                  >
                    <Upload size={14} className="mr-1" /> Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(song)}
                    className="flex-1"
                    data-testid={`edit-song-${song.id}`}
                  >
                    <Edit size={14} className="mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setDeletingSongId(song.id); setDeleteDialogOpen(true); }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`delete-song-${song.id}`}
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
    </div>
  );
}

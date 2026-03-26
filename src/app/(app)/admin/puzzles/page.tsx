"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Check, X, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Puzzle {
  id: number;
  day_index: number;
  puzzle: string;
  answer: string;
  is_active: boolean;
}

export default function PuzzlesAdminPage() {
  const supabase = createClient();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPuzzle, setEditPuzzle] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  // Add new puzzle state
  const [adding, setAdding] = useState(false);
  const [newPuzzle, setNewPuzzle] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newIndex, setNewIndex] = useState("");

  // Delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) { setIsAdmin(false); setLoading(false); return; }
      setIsAdmin(true);

      const { data } = await supabase
        .from("puzzles")
        .select("*")
        .order("day_index");

      if (data) setPuzzles(data);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(p: Puzzle) {
    setEditingId(p.id);
    setEditPuzzle(p.puzzle);
    setEditAnswer(p.answer);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPuzzle("");
    setEditAnswer("");
  }

  async function saveEdit(p: Puzzle) {
    if (!editPuzzle.trim() || !editAnswer.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("puzzles")
      .update({ puzzle: editPuzzle.trim(), answer: editAnswer.trim() })
      .eq("id", p.id);

    if (!error) {
      setPuzzles((prev) =>
        prev.map((x) =>
          x.id === p.id ? { ...x, puzzle: editPuzzle.trim(), answer: editAnswer.trim() } : x
        )
      );
    }
    setSaving(false);
    cancelEdit();
  }

  async function toggleActive(p: Puzzle) {
    const { error } = await supabase
      .from("puzzles")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);

    if (!error) {
      setPuzzles((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x))
      );
    }
  }

  async function addPuzzle() {
    if (!newPuzzle.trim() || !newAnswer.trim() || newIndex === "") return;
    const idx = parseInt(newIndex);
    if (isNaN(idx) || idx < 0) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("puzzles")
      .insert({ day_index: idx, puzzle: newPuzzle.trim(), answer: newAnswer.trim() })
      .select()
      .single();

    if (!error && data) {
      setPuzzles((prev) => [...prev, data].sort((a, b) => a.day_index - b.day_index));
      setAdding(false);
      setNewPuzzle("");
      setNewAnswer("");
      setNewIndex("");
    }
    setSaving(false);
  }

  async function deletePuzzle(id: number) {
    const { error } = await supabase.from("puzzles").delete().eq("id", id);
    if (!error) {
      setPuzzles((prev) => prev.filter((p) => p.id !== id));
    }
    setDeletingId(null);
  }

  const filtered = puzzles.filter(
    (p) =>
      p.puzzle.toLowerCase().includes(search.toLowerCase()) ||
      p.answer.toLowerCase().includes(search.toLowerCase()) ||
      String(p.day_index).includes(search)
  );

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-secondary">Loading...</p>
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-display text-2xl neon-text-pink tracking-widest">ADMIN ONLY</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-3xl neon-text-gold tracking-widest">PUZZLES</h1>
          <p className="text-text-secondary text-xs mt-0.5">
            {puzzles.length} total · {puzzles.filter((p) => p.is_active).length} active
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search puzzles or answers..."
          className="w-full bg-surface border border-surface-2 rounded-xl pl-9 pr-4 py-3 text-text-primary text-sm focus:outline-none focus:border-neon-gold/60 placeholder:text-text-secondary"
        />
      </div>

      {/* Add new puzzle button */}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 w-full bg-surface border border-dashed border-neon-gold/30 hover:border-neon-gold/60 rounded-xl p-4 text-text-secondary hover:text-neon-gold transition-colors mb-4 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add new puzzle
        </button>
      )}

      {/* Add new puzzle form */}
      {adding && (
        <div className="bg-surface border border-neon-gold rounded-xl p-4 mb-4 space-y-3">
          <p className="text-neon-gold text-xs uppercase tracking-widest font-medium">New Puzzle</p>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Day Index</label>
            <input
              type="number"
              value={newIndex}
              onChange={(e) => setNewIndex(e.target.value)}
              placeholder={`e.g. ${puzzles.length}`}
              className="w-full bg-surface-2 border border-surface-2 rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-gold"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Puzzle (emoji riddle)</label>
            <input
              value={newPuzzle}
              onChange={(e) => setNewPuzzle(e.target.value)}
              placeholder="e.g. 🐶 + IT"
              className="w-full bg-surface-2 border border-surface-2 rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-gold"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Answer</label>
            <input
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="e.g. Doggin It"
              className="w-full bg-surface-2 border border-surface-2 rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-gold"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={addPuzzle}
              disabled={saving || !newPuzzle.trim() || !newAnswer.trim() || newIndex === ""}
              className="flex items-center gap-1.5 bg-neon-gold text-black font-medium text-sm px-4 py-2 rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => { setAdding(false); setNewPuzzle(""); setNewAnswer(""); setNewIndex(""); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary border border-surface-2 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Puzzle list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-text-secondary text-sm py-8">No puzzles found</p>
        )}

        {filtered.map((p) => {
          const isEditing = editingId === p.id;
          const isDeleting = deletingId === p.id;

          return (
            <div
              key={p.id}
              className={`bg-surface rounded-xl border transition-colors ${
                isEditing
                  ? "border-neon-gold"
                  : isDeleting
                  ? "border-neon-pink"
                  : p.is_active
                  ? "border-surface-2"
                  : "border-surface-2 opacity-50"
              }`}
            >
              {isDeleting ? (
                <div className="p-4">
                  <p className="text-text-primary text-sm mb-3">
                    Delete puzzle #{p.day_index}? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deletePuzzle(p.id)}
                      className="bg-neon-pink text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-text-secondary border border-surface-2 text-xs px-3 py-1.5 rounded-lg hover:text-text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : isEditing ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display text-neon-gold text-sm">#{p.day_index}</span>
                    <span className="text-text-secondary text-xs">Editing</span>
                  </div>
                  <div>
                    <label className="text-text-secondary text-xs mb-1 block">Puzzle</label>
                    <input
                      value={editPuzzle}
                      onChange={(e) => setEditPuzzle(e.target.value)}
                      autoFocus
                      className="w-full bg-surface-2 border border-neon-gold/40 rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-gold"
                    />
                  </div>
                  <div>
                    <label className="text-text-secondary text-xs mb-1 block">Answer</label>
                    <input
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      className="w-full bg-surface-2 border border-neon-gold/40 rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-gold"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(p)}
                      disabled={saving}
                      className="flex items-center gap-1.5 bg-neon-gold text-black font-medium text-sm px-4 py-2 rounded-lg disabled:opacity-40 hover:opacity-90"
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary border border-surface-2 text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Day index badge */}
                    <span className="font-display text-neon-gold text-sm w-8 shrink-0 pt-0.5">
                      #{p.day_index}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-lg leading-snug">{p.puzzle}</p>
                      <p className="text-text-secondary text-xs mt-1 tracking-wider">
                        {p.answer}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(p)}
                        title={p.is_active ? "Deactivate" : "Activate"}
                        className={`w-8 h-5 rounded-full transition-colors relative ${
                          p.is_active ? "bg-neon-gold/40" : "bg-surface-2"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                            p.is_active
                              ? "right-0.5 bg-neon-gold"
                              : "left-0.5 bg-text-secondary"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        className="text-text-secondary hover:text-neon-gold transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(p.id)}
                        className="text-text-secondary hover:text-neon-pink transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

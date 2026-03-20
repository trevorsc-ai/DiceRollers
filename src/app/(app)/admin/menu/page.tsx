"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Check, X, Upload } from "lucide-react";

interface MenuItem {
  id: number;
  die_color: "red" | "white";
  die_number: number;
  drink_name: string;
  logo_url: string | null;
  is_active: boolean;
}

export default function MenuPage() {
  const supabase = createClient();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null!) as React.MutableRefObject<HTMLInputElement>;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        setIsAdmin(profile?.is_admin ?? false);
      }

      const { data } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_active", true)
        .order("die_number");
      if (data) setMenu(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditName(item.drink_name);
    setEditLogo(null);
    setEditLogoPreview(item.logo_url);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditLogo(null);
    setEditLogoPreview(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditLogo(file);
    setEditLogoPreview(URL.createObjectURL(file));
  }

  async function saveEdit(item: MenuItem) {
    setSaving(true);
    let logoUrl = item.logo_url;

    if (editLogo) {
      const ext = editLogo.name.split(".").pop();
      const path = `menu/${item.die_color}-${item.die_number}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("drink-logos")
        .upload(path, editLogo, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("drink-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase
      .from("menu_items")
      .update({ drink_name: editName, logo_url: logoUrl })
      .eq("id", item.id);

    if (!error) {
      setMenu((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, drink_name: editName, logo_url: logoUrl } : m
        )
      );
    }
    setSaving(false);
    cancelEdit();
  }

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
        <p className="text-text-secondary text-sm mt-2">The menu is managed by bar staff.</p>
      </div>
    </div>
  );

  const redItems = menu.filter((m) => m.die_color === "red").sort((a, b) => a.die_number - b.die_number);
  const whiteItems = menu.filter((m) => m.die_color === "white").sort((a, b) => a.die_number - b.die_number);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">MENU</h1>
        <p className="text-text-secondary text-xs mt-1 tracking-widest">Jackie Lee&apos;s Dice Roll Combos</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MenuColumn
          title="🔴 BEERS"
          items={redItems}
          color="red"
          isAdmin={isAdmin}
          editingId={editingId}
          editName={editName}
          editLogoPreview={editLogoPreview}
          saving={saving}
          fileRef={fileRef}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onEditNameChange={setEditName}
          onFileChange={handleFileChange}
        />
        <MenuColumn
          title="⚪ SHOTS"
          items={whiteItems}
          color="white"
          isAdmin={isAdmin}
          editingId={editingId}
          editName={editName}
          editLogoPreview={editLogoPreview}
          saving={saving}
          fileRef={fileRef}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onEditNameChange={setEditName}
          onFileChange={handleFileChange}
        />
      </div>
    </div>
  );
}

function MenuColumn({
  title, items, color, isAdmin, editingId, editName, editLogoPreview,
  saving, fileRef, onStartEdit, onCancelEdit, onSaveEdit, onEditNameChange, onFileChange,
}: {
  title: string;
  items: MenuItem[];
  color: "red" | "white";
  isAdmin: boolean;
  editingId: number | null;
  editName: string;
  editLogoPreview: string | null;
  saving: boolean;
  fileRef: React.RefObject<HTMLInputElement>;
  onStartEdit: (item: MenuItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (item: MenuItem) => void;
  onEditNameChange: (name: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isRed = color === "red";
  const accent = isRed ? "text-neon-pink" : "text-text-primary";

  return (
    <div>
      <h2 className={`font-display text-lg tracking-widest mb-3 ${accent}`}>{title}</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const isEditing = editingId === item.id;
          return (
            <div
              key={item.id}
              className={`bg-surface rounded-xl p-3 border transition-colors ${
                isEditing ? "border-neon-gold" : "border-surface-2"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Die number */}
                <span
                  className={`font-display text-xl w-6 shrink-0 ${isRed ? "text-neon-pink" : "text-text-primary"}`}
                >
                  {item.die_number}
                </span>

                {/* Logo thumbnail */}
                <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden bg-surface-2 flex items-center justify-center">
                  {(isEditing ? editLogoPreview : item.logo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(isEditing ? editLogoPreview : item.logo_url)!}
                      alt={item.drink_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-text-secondary text-xs">?</span>
                  )}
                </div>

                {/* Name */}
                {isEditing ? (
                  <input
                    value={editName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                    className="flex-1 bg-surface-2 border border-neon-gold/40 rounded px-2 py-1 text-text-primary text-xs focus:outline-none focus:border-neon-gold min-w-0"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-text-primary text-xs font-medium leading-tight min-w-0 truncate">
                    {item.drink_name}
                  </span>
                )}

                {/* Admin actions */}
                {isAdmin && (
                  isEditing ? (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="text-text-secondary hover:text-neon-gold"
                        title="Upload logo"
                      >
                        <Upload className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onSaveEdit(item)}
                        disabled={saving}
                        className="text-neon-green"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={onCancelEdit} className="text-neon-pink">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onStartEdit(item)}
                      className="text-text-secondary hover:text-neon-gold shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}

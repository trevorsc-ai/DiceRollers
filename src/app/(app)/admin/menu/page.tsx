"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Check, X, Upload } from "lucide-react";
import {
  adminMenuQueryKey,
  fetchAdminMenu,
  isHalloweenMenu,
  type MenuItem,
} from "@/lib/queries/menu";

const MENU_QUERY_KEY = adminMenuQueryKey();

export default function MenuPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null!) as React.MutableRefObject<HTMLInputElement>;

  // Admin gating happens server-side in /admin/layout.tsx — anyone reaching
  // this page is an admin, so we always show edit controls.
  const isAdmin = true;

  const { data: menu = [], isLoading: loading, error: menuError } = useQuery({
    queryKey: MENU_QUERY_KEY,
    queryFn: () => fetchAdminMenu(supabase),
  });
  const halloweenOn = isHalloweenMenu(menu);

  // Not optimistic on purpose: this swaps the live menu for every player, so
  // the switch only shows the new state once the database confirms it.
  const toggleHalloween = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc("set_halloween_menu", { enabled });
      if (error) throw error;
    },
    onError: (err) => {
      console.error("set_halloween_menu failed", err);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["menuItems"] }),
  });

  function handleToggleHalloween() {
    const enabling = !halloweenOn;
    const message = enabling
      ? "Turn ON the Halloween menu for everyone? The white die switches to the Halloween shots and the Daily Double is off."
      : "Turn OFF the Halloween menu? Everyone goes back to the regular shots and the Daily Double.";
    if (confirm(message)) toggleHalloween.mutate(enabling);
  }

  const saveItem = useMutation({
    mutationFn: async ({ item, name, logo }: { item: MenuItem; name: string; logo: File | null }) => {
      let logoUrl = item.logo_url;
      if (logo) {
        const ext = logo.name.split(".").pop();
        const path = `menu/${item.die_color}-${item.die_number}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("drink-logos")
          .upload(path, logo, { upsert: true });
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from("drink-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }
      const { error } = await supabase
        .from("menu_items")
        .update({ drink_name: name, logo_url: logoUrl })
        .eq("id", item.id);
      if (error) throw error;
      return { id: item.id, name, logoUrl };
    },
    onSuccess: ({ id, name, logoUrl }) => {
      queryClient.setQueryData<MenuItem[]>(MENU_QUERY_KEY, (prev) =>
        (prev ?? []).map((m) => (m.id === id ? { ...m, drink_name: name, logo_url: logoUrl } : m))
      );
      queryClient.invalidateQueries({ queryKey: ["menuItems", "active"] });
      cancelEdit();
    },
    onError: (err) => {
      console.error("Menu item save failed", err);
    },
  });
  const saving = saveItem.isPending;

  function startEdit(item: MenuItem) {
    saveItem.reset();
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

  function saveEdit(item: MenuItem) {
    saveItem.mutate({ item, name: editName, logo: editLogo });
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-secondary">Loading...</p>
    </div>
  );

  const regular = menu.filter((m) => m.menu_set === "regular");
  const byDie = (a: MenuItem, b: MenuItem) => a.die_number - b.die_number;
  const redItems = regular.filter((m) => m.die_color === "red").sort(byDie);
  const whiteItems = regular.filter((m) => m.die_color === "white").sort(byDie);
  const dailyDoubleItems = regular.filter((m) => m.die_color === "daily_double").sort(byDie);
  const halloweenItems = menu
    .filter((m) => m.menu_set === "halloween" && m.die_color === "white")
    .sort(byDie);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">MENU</h1>
        <p className="text-text-secondary text-xs mt-1 tracking-widest">Jackie Lee&apos;s Dice Roll Combos</p>
      </div>

      {menuError && (
        <p className="text-neon-pink text-xs text-center mb-4">Couldn&apos;t load the menu. Refresh to try again.</p>
      )}
      {saveItem.error && (
        <p className="text-neon-pink text-xs text-center mb-4">{saveItem.error.message}</p>
      )}

      {/* Halloween toggle */}
      <div
        className="bg-surface rounded-xl p-4 border mb-6 flex items-center justify-between gap-3"
        style={{ borderColor: halloweenOn ? "#FF7A00" : "rgba(168,85,247,0.35)" }}
      >
        <div className="min-w-0">
          <p className="font-display text-base tracking-widest" style={{ color: "#FF7A00" }}>
            🎃 HALLOWEEN MENU
          </p>
          <p className="text-text-secondary text-xs mt-0.5">
            {halloweenOn
              ? "ON: white die uses the Halloween shots. No Daily Double. Roll page is spooky."
              : "OFF: regular shots and Daily Double. Edit the Halloween shots below anytime."}
          </p>
          {toggleHalloween.error && (
            <p className="text-neon-pink text-xs mt-1">
              Couldn&apos;t switch the menu: {toggleHalloween.error.message}
            </p>
          )}
        </div>
        <button
          role="switch"
          aria-checked={halloweenOn}
          aria-label="Halloween menu"
          onClick={handleToggleHalloween}
          disabled={toggleHalloween.isPending || halloweenItems.length === 0}
          className="relative shrink-0 w-14 h-8 rounded-full border transition-colors disabled:opacity-50"
          style={{
            background: halloweenOn ? "#FF7A00" : "#181818",
            borderColor: halloweenOn ? "#FF7A00" : "#2A2A2A",
          }}
        >
          <span
            className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all"
            style={{ left: halloweenOn ? "calc(100% - 1.75rem)" : "0.25rem" }}
          />
        </button>
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
          subtitle={halloweenOn ? "Off while Halloween is on" : undefined}
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

      {/* Daily Double section */}
      {dailyDoubleItems.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg tracking-widest mb-1 text-neon-gold">🎲 DAILY DOUBLE</h2>
          <p className="text-text-secondary text-xs mb-3">Shown as substitute when players roll doubles</p>
          <div className="grid grid-cols-2 gap-4">
            {dailyDoubleItems.map((item) => {
              const label = item.die_number === 1 ? "Beer" : "Shot";
              return (
                <div
                  key={item.id}
                  className={`bg-surface rounded-xl p-3 border transition-colors ${
                    editingId === item.id ? "border-neon-gold" : "border-neon-gold/20"
                  }`}
                >
                  <p className="text-neon-gold text-[10px] uppercase tracking-widest mb-2">{label}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden bg-surface-2 flex items-center justify-center">
                      {(editingId === item.id ? editLogoPreview : item.logo_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(editingId === item.id ? editLogoPreview : item.logo_url) ?? ""}
                          alt={item.drink_name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-text-secondary text-xs">?</span>
                      )}
                    </div>
                    {editingId === item.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-surface-2 border border-neon-gold/40 rounded px-2 py-1 text-text-primary text-xs focus:outline-none focus:border-neon-gold min-w-0"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 text-text-primary text-xs font-medium leading-tight min-w-0 truncate">
                        {item.drink_name}
                      </span>
                    )}
                    {isAdmin && (
                      editingId === item.id ? (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => fileRef.current?.click()}
                            className="text-text-secondary hover:text-neon-gold"
                            title="Upload logo"
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => saveEdit(item)}
                            disabled={saving}
                            className="text-neon-green"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={cancelEdit} className="text-neon-pink">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(item)}
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
        </div>
      )}

      {/* Halloween shots: editable whether or not the menu is on */}
      {halloweenItems.length > 0 && (
        <div className="mt-6">
          <MenuColumn
            title="🎃 HALLOWEEN SHOTS"
            subtitle={halloweenOn ? "Live now on the white die" : "Not live. Flip the toggle above to use these."}
            accentClassName="text-[#FF7A00]"
            items={halloweenItems}
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
      )}
    </div>
  );
}

function MenuColumn({
  title, subtitle, accentClassName, items, color, isAdmin, editingId, editName, editLogoPreview,
  saving, fileRef, onStartEdit, onCancelEdit, onSaveEdit, onEditNameChange, onFileChange,
}: {
  title: string;
  subtitle?: string;
  /** Overrides the title/die-number colour (e.g. Halloween orange). */
  accentClassName?: string;
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
  const accent = accentClassName ?? (isRed ? "text-neon-pink" : "text-text-primary");

  return (
    <div>
      <h2 className={`font-display text-lg tracking-widest ${subtitle ? "mb-1" : "mb-3"} ${accent}`}>{title}</h2>
      {subtitle && <p className="text-text-secondary text-xs mb-3">{subtitle}</p>}
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
                  className={`font-display text-xl w-6 shrink-0 ${accent}`}
                >
                  {item.die_number}
                </span>

                {/* Logo thumbnail */}
                <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden bg-surface-2 flex items-center justify-center">
                  {(isEditing ? editLogoPreview : item.logo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(isEditing ? editLogoPreview : item.logo_url) ?? ""}
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

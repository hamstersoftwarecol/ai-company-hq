"use client";

import { useCallback, useEffect, useState } from "react";
import { createFolder, listFolders, type FolderListing } from "@/lib/api";

interface Props {
  /** Folder to start in (e.g. what the user already typed); falls back to home. */
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

/** Browse the user's folders (inside ~) and pick or create the project folder. */
export default function FolderPicker({ initialPath, onSelect, onClose }: Props) {
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (path?: string) => {
    setError("");
    try {
      setListing(await listFolders(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la carpeta.");
    }
  }, []);

  useEffect(() => {
    // Start where the user was; if that path is not valid, start at home.
    listFolders(initialPath?.trim() || undefined)
      .catch(() => listFolders())
      .then(setListing)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo leer tus carpetas."));
  }, [initialPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleCreate() {
    if (!listing || !newName.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { path } = await createFolder(listing.path, newName.trim());
      setNewName("");
      await load(path); // go inside the new folder, ready to be chosen
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la carpeta.");
    } finally {
      setBusy(false);
    }
  }

  const atHome = listing ? listing.path === listing.home : true;
  const shown = listing ? listing.path.replace(listing.home, "~") : "…";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3a2f2a]/40 p-4" role="dialog" aria-label="Elegir carpeta">
      <div className="px-panel flex max-h-[90vh] w-full max-w-lg flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[11px]">ELEGIR CARPETA</h2>
          <button type="button" onClick={onClose} className="px-btn px-btn-ghost" aria-label="Cerrar">
            X
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-btn px-btn-ghost shrink-0"
            disabled={!listing?.parent}
            onClick={() => listing?.parent && load(listing.parent)}
          >
            ↑ SUBIR
          </button>
          <code className="min-w-0 flex-1 truncate border-2 border-[#3a2f2a] bg-[#faf6ee] px-2 py-2 text-xs" title={listing?.path}>
            {shown}
          </code>
        </div>

        <ul className="min-h-24 flex-1 overflow-y-auto border-2 border-[#3a2f2a] bg-white" aria-label="Subcarpetas">
          {listing && listing.folders.length === 0 && (
            <li className="p-3 text-sm text-[#6b5d52]">Esta carpeta no tiene subcarpetas.</li>
          )}
          {listing?.folders.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => load(f.path)}
                className="flex w-full items-center gap-2 border-b border-[#3a2f2a]/15 px-3 py-2 text-left text-sm hover:bg-[#fff1d6]"
              >
                <span className="inline-block h-3 w-4 shrink-0 border-2 border-[#3a2f2a] bg-[#ffcf6b]" aria-hidden />
                {f.name}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nueva carpeta aquí…"
            className="px-input"
            aria-label="Nombre de la nueva carpeta"
            spellCheck={false}
          />
          <button type="button" onClick={handleCreate} disabled={!newName.trim() || busy || !listing} className="px-btn px-btn-ghost shrink-0">
            CREAR
          </button>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {atHome && listing && (
          <p className="text-xs text-[#6b5d52]">Entra a una carpeta o crea una nueva: la carpeta personal en sí no se puede usar.</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            className="px-btn flex-1"
            disabled={!listing || atHome}
            onClick={() => listing && onSelect(listing.path)}
          >
            USAR ESTA CARPETA
          </button>
          <button type="button" onClick={onClose} className="px-btn px-btn-ghost">
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  Link2,
  Info,
  Plus,
  X,
  Save,
  ChevronDown,
  Edit3,
  Eye,
  Compass,
} from "lucide-react";
import type { Scene, Hotspot } from "@/lib/types";
import { imageUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  scene: Scene;
  index: number;
  totalScenes: number;
  allScenes: Scene[];
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddSceneHotspot: (targetSceneId: string) => void;
  onAddInfoHotspot: () => void;
  onDeleteHotspot: (hotspotId: string) => void;
  onUpdateHotspot: (hotspotId: string, patch: Partial<Hotspot>) => void;
};

export default function SceneCard({
  scene,
  index,
  totalScenes,
  allScenes,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddSceneHotspot,
  onAddInfoHotspot,
  onDeleteHotspot,
  onUpdateHotspot,
}: Props) {
  const [editingHotspot, setEditingHotspot] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  function pickPosition(e: React.MouseEvent<HTMLImageElement>) {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = (e.clientY - rect.top) / rect.height; // 0..1
    // equirectangular: yaw 0..2π, pitch π/2..-π/2
    const yaw = x * 2 * Math.PI;
    const pitch = (0.5 - y) * Math.PI;
    return { yaw, pitch };
  }

  function handlePlaceHotspot(e: React.MouseEvent<HTMLImageElement>) {
    if (!editingHotspot) return;
    e.preventDefault();
    const pos = pickPosition(e);
    if (!pos) return;
    onUpdateHotspot(editingHotspot, pos);
    setEditingHotspot(null);
  }

  const otherScenes = allScenes.filter((s) => s.id !== scene.id);

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {index + 1}
          </span>
          <input
            className="font-medium bg-transparent flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            defaultValue={scene.name}
            key={scene.name}
            onBlur={async (e) => {
              if (e.target.value && e.target.value !== scene.name) {
                await fetch(`/api/tours/_/scenes/${scene.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: e.target.value }),
                });
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            className="h-8 w-8"
            title="Move up"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === totalScenes - 1}
            className="h-8 w-8"
            title="Move down"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Equirectangular image with hotspot overlay */}
          <div>
            <div className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1">
              <Compass className="w-3 h-3" /> Equirectangular preview (click to place hotspot)
            </div>
            <div
              className="relative rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900"
              style={{ aspectRatio: "2 / 1" }}
            >
              <img
                ref={imgRef}
                src={imageUrl(scene.file)}
                alt={scene.name}
                className={`absolute inset-0 w-full h-full object-cover select-none ${
                  editingHotspot ? "cursor-crosshair" : "cursor-default"
                }`}
                draggable={false}
                onClick={handlePlaceHotspot}
              />
              {scene.hotspots.map((h) => (
                <HotspotMarker
                  key={h.id}
                  hotspot={h}
                  isEditing={editingHotspot === h.id}
                />
              ))}
            </div>
            {editingHotspot && (
              <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                Click on the image to place this hotspot.
                <button
                  className="ml-2 underline"
                  onClick={() => setEditingHotspot(null)}
                >
                  cancel
                </button>
              </p>
            )}
          </div>

          {/* Hotspots panel */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <AddHotspotMenu
                otherScenes={otherScenes}
                onAddSceneHotspot={(id) => {
                  onAddSceneHotspot(id);
                }}
                onAddInfoHotspot={onAddInfoHotspot}
              />
            </div>

            {scene.hotspots.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-2">
                No hotspots yet. Add scene links to connect rooms, or info hotspots for descriptions.
              </p>
            ) : (
              <div className="space-y-1.5">
                {scene.hotspots.map((h) => {
                  const target = h.targetSceneId
                    ? allScenes.find((s) => s.id === h.targetSceneId)
                    : null;
                  return (
                    <div
                      key={h.id}
                      className={`p-2 rounded border text-xs ${
                        editingHotspot === h.id
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {h.type === "scene" ? (
                          <Link2 className="w-3.5 h-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                        ) : (
                          <Info className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {h.type === "scene" ? (
                            <p className="font-medium truncate">
                              → {target?.name ?? "(missing scene)"}
                            </p>
                          ) : (
                            <p className="font-medium truncate">
                              {h.title || "Info hotspot"}
                            </p>
                          )}
                          <p className="text-zinc-500">
                            yaw {(h.yaw * (180 / Math.PI)).toFixed(0)}°, pitch{" "}
                            {(h.pitch * (180 / Math.PI)).toFixed(0)}°
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setEditingHotspot(
                              editingHotspot === h.id ? null : h.id,
                            )
                          }
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                          title="Reposition on image"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteHotspot(h.id)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950 text-red-500 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {h.type === "info" && editingHotspot !== h.id && (
                        <div className="mt-1.5 grid grid-cols-1 gap-1">
                          <input
                            className="w-full text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1"
                            defaultValue={h.title ?? ""}
                            placeholder="Title"
                            onBlur={(e) =>
                              onUpdateHotspot(h.id, { title: e.target.value })
                            }
                          />
                          <textarea
                            className="w-full text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 resize-none"
                            defaultValue={h.text ?? ""}
                            placeholder="Description"
                            rows={2}
                            onBlur={(e) =>
                              onUpdateHotspot(h.id, { text: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {scene.hotspots.length >= 2 && (
              <p className="text-[11px] text-zinc-500 pt-1">
                Tip: edit a hotspot to reposition, then click on the image to set its location.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HotspotMarker({
  hotspot,
  isEditing,
}: {
  hotspot: Hotspot;
  isEditing: boolean;
}) {
  const x = (hotspot.yaw / (2 * Math.PI)) * 100;
  const y = (0.5 - hotspot.pitch / Math.PI) * 100;
  return (
    <div
      className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div
        className={`rounded-full p-1.5 ${
          isEditing
            ? "bg-blue-500 ring-4 ring-blue-500/30"
            : hotspot.type === "scene"
              ? "bg-blue-500"
              : "bg-amber-500"
        } shadow-md`}
      >
        {hotspot.type === "scene" ? (
          <Link2 className="w-3 h-3 text-white" />
        ) : (
          <Info className="w-3 h-3 text-white" />
        )}
      </div>
    </div>
  );
}

function AddHotspotMenu({
  otherScenes,
  onAddSceneHotspot,
  onAddInfoHotspot,
}: {
  otherScenes: Scene[];
  onAddSceneHotspot: (id: string) => void;
  onAddInfoHotspot: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sceneMenu, setSceneMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSceneMenu(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Add hotspot
        <ChevronDown className="w-3 h-3" />
      </Button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-1 min-w-[180px]">
          <div className="relative">
            <button
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded flex items-center gap-1.5"
              onClick={() => setSceneMenu(!sceneMenu)}
            >
              <Link2 className="w-3 h-3" /> Link to scene…
              <ChevronDown className="w-3 h-3 ml-auto" />
            </button>
            {sceneMenu && (
              <div className="absolute left-full top-0 ml-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-1 min-w-[180px] max-h-60 overflow-auto">
                {otherScenes.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-zinc-500 italic">
                    No other scenes yet
                  </p>
                ) : (
                  otherScenes.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                      onClick={() => {
                        onAddSceneHotspot(s.id);
                        setOpen(false);
                        setSceneMenu(false);
                      }}
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded flex items-center gap-1.5"
            onClick={() => {
              onAddInfoHotspot();
              setOpen(false);
            }}
          >
            <Info className="w-3 h-3" /> Info hotspot
          </button>
        </div>
      )}
    </div>
  );
}

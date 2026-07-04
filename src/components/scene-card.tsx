import { useState, useRef, useEffect } from "react";
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  Link2,
  Info,
  Plus,
  Save,
  Edit3,
  Compass,
  MousePointerClick,
  X,
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
  // Existing per-step API (for reposition, info hotspot, etc.)
  onAddSceneHotspot: (targetSceneId: string) => void;
  onAddInfoHotspot: () => void;
  onDeleteHotspot: (hotspotId: string) => void;
  onUpdateHotspot: (hotspotId: string, patch: Partial<Hotspot>) => void;
  // New: create + place in one go
  onCreateAndPlaceSceneHotspot: (targetSceneId: string, yaw: number, pitch: number) => void;
  onCreateAndPlaceInfoHotspot: (yaw: number, pitch: number) => void;
  onRenameScene: (name: string) => void;
};

type ToolMode = "off" | "link" | "info";

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
  onCreateAndPlaceSceneHotspot,
  onCreateAndPlaceInfoHotspot,
  onRenameScene,
}: Props) {
  const [editingHotspot, setEditingHotspot] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("off");
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function pickPosition(e: React.MouseEvent<HTMLImageElement>) {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = (e.clientY - rect.top) / rect.height; // 0..1
    const yaw = x * 2 * Math.PI;
    const pitch = (0.5 - y) * Math.PI;
    return { yaw, pitch };
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (editingHotspot) {
      // Reposition an existing hotspot
      e.preventDefault();
      const pos = pickPosition(e);
      if (!pos) return;
      onUpdateHotspot(editingHotspot, pos);
      setEditingHotspot(null);
      return;
    }
    if (tool === "link" && pendingTarget) {
      e.preventDefault();
      const pos = pickPosition(e);
      if (!pos) return;
      onCreateAndPlaceSceneHotspot(pendingTarget, pos.yaw, pos.pitch);
      setTool("off");
      setPendingTarget(null);
      return;
    }
    if (tool === "info") {
      e.preventDefault();
      const pos = pickPosition(e);
      if (!pos) return;
      onCreateAndPlaceInfoHotspot(pos.yaw, pos.pitch);
      setTool("off");
      return;
    }
  }

  function startLinkTool() {
    setTool((t) => (t === "link" ? "off" : "link"));
    setPendingTarget(null);
    setEditingHotspot(null);
  }

  function startInfoTool() {
    setTool((t) => (t === "info" ? "off" : "info"));
    setPendingTarget(null);
    setEditingHotspot(null);
  }

  function cancelTool() {
    setTool("off");
    setPendingTarget(null);
  }

  const otherScenes = allScenes.filter((s) => s.id !== scene.id);
  const cursorClass =
    editingHotspot || (tool === "link" && pendingTarget) || tool === "info"
      ? "cursor-crosshair"
      : "cursor-default";

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
            onBlur={(e) => {
              if (e.target.value && e.target.value !== scene.name) {
                onRenameScene(e.target.value);
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Equirectangular image with hotspot overlay */}
          <div>
            <div className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1">
              <Compass className="w-3 h-3" /> Equirectangular preview — click to place hotspot
            </div>
            <div
              className="relative rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900"
              style={{ aspectRatio: "2 / 1" }}
            >
              <img
                ref={imgRef}
                src={imageUrl(scene.file)}
                alt={scene.name}
                className={`absolute inset-0 w-full h-full object-cover select-none ${cursorClass}`}
                draggable={false}
                onClick={handleImageClick}
              />
              {scene.hotspots.map((h) => (
                <HotspotMarker
                  key={h.id}
                  hotspot={h}
                  isEditing={editingHotspot === h.id}
                />
              ))}
            </div>
            <ToolHint
              tool={tool}
              editingHotspot={editingHotspot}
              pendingTarget={pendingTarget}
              otherScenes={otherScenes}
              onCancel={cancelTool}
            />
          </div>

          {/* Hotspots panel */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant={tool === "link" ? "default" : "outline"}
                onClick={startLinkTool}
                className="gap-1.5"
                title="Add a navigation arrow to another scene"
              >
                <Link2 className="w-3.5 h-3.5" /> Add link
              </Button>
              <Button
                size="sm"
                variant={tool === "info" ? "default" : "outline"}
                onClick={startInfoTool}
                className="gap-1.5"
                title="Add a labeled info point"
              >
                <Info className="w-3.5 h-3.5" /> Add info
              </Button>
            </div>

            {/* Scene picker (appears when "Add link" is active) */}
            {tool === "link" && (
              <ScenePicker
                otherScenes={otherScenes}
                selectedId={pendingTarget}
                onSelect={setPendingTarget}
              />
            )}

            {scene.hotspots.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-2">
                No hotspots yet. Use "Add link" to connect rooms, or "Add info" to label features.
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
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {h.type === "scene" && target && (
                            <img
                              src={imageUrl(target.file)}
                              alt=""
                              className="w-10 h-5 object-cover rounded flex-shrink-0"
                            />
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
                Tip: click the pencil to reposition an existing hotspot, then click the image.
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

function ToolHint({
  tool,
  editingHotspot,
  pendingTarget,
  otherScenes,
  onCancel,
}: {
  tool: ToolMode;
  editingHotspot: string | null;
  pendingTarget: string | null;
  otherScenes: Scene[];
  onCancel: () => void;
}) {
  if (editingHotspot) {
    return (
      <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
        <MousePointerClick className="w-3 h-3" />
        Click on the image to move this hotspot.
        <button className="ml-auto underline" onClick={onCancel}>
          cancel
        </button>
      </p>
    );
  }
  if (tool === "link") {
    if (!pendingTarget) {
      return (
        <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
          <MousePointerClick className="w-3 h-3" />
          Pick the target scene on the right, then click where the door/opening is.
          <button className="ml-auto underline" onClick={onCancel}>
            cancel
          </button>
        </p>
      );
    }
    const target = otherScenes.find((s) => s.id === pendingTarget);
    return (
      <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
        <MousePointerClick className="w-3 h-3" />
        Click on the image to drop the arrow into <strong>{target?.name}</strong>.
        <button className="ml-auto underline" onClick={onCancel}>
          cancel
        </button>
      </p>
    );
  }
  if (tool === "info") {
    return (
      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <MousePointerClick className="w-3 h-3" />
        Click on the image to place an info hotspot. You can edit the label after.
        <button className="ml-auto underline" onClick={onCancel}>
          cancel
        </button>
      </p>
    );
  }
  return null;
}

function ScenePicker({
  otherScenes,
  selectedId,
  onSelect,
}: {
  otherScenes: Scene[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (otherScenes.length === 0) {
    return (
      <div className="p-3 rounded border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500 italic">
        Upload at least one other scene first.
      </div>
    );
  }
  return (
    <div className="p-2 rounded border border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
      <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300 mb-1.5">
        Link to which scene?
      </p>
      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
        {otherScenes.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group text-left rounded overflow-hidden border-2 transition-all ${
              selectedId === s.id
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : "border-zinc-200 dark:border-zinc-800 hover:border-blue-400"
            }`}
          >
            <div className="relative aspect-[2/1] bg-zinc-100 dark:bg-zinc-900">
              <img
                src={imageUrl(s.file)}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="px-1.5 py-1 bg-white dark:bg-zinc-900">
              <p className="text-[11px] font-medium truncate">{s.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

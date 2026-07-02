import { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Eye,
} from "lucide-react";
import {
  getTour,
  uploadScene,
  deleteScene,
  reorderScenes,
  addHotspot,
  deleteHotspot,
  updateTour,
  updateScene,
  imageUrl,
} from "@/lib/api";
import type { Tour, Hotspot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SceneCard from "@/components/scene-card";

export default function Admin() {
  const { id } = useParams<{ id: string }>();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const t = await getTour(id!);
      setTour(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !tour) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        const sceneName = baseName || "Untitled scene";
        await uploadScene(tour.id, file, sceneName);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteScene(sceneId: string) {
    if (!tour) return;
    const scene = tour.scenes.find((s) => s.id === sceneId);
    if (!confirm(`Delete scene "${scene?.name}"?`)) return;
    await deleteScene(tour.id, sceneId);
    await load();
  }

  async function handleReorder(sceneId: string, direction: -1 | 1) {
    if (!tour) return;
    const idx = tour.scenes.findIndex((s) => s.id === sceneId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= tour.scenes.length) return;
    const next = [...tour.scenes];
    const [moved] = next.splice(idx, 1);
    next.splice(newIdx, 0, moved);
    await reorderScenes(tour.id, next.map((s) => s.id));
    await load();
  }

  async function handleAddSceneHotspot(sceneId: string, targetSceneId: string) {
    if (!tour) return;
    await addHotspot(tour.id, sceneId, {
      type: "scene",
      yaw: 0,
      pitch: 0,
      targetSceneId,
    });
    await load();
  }

  async function handleAddInfoHotspot(sceneId: string) {
    if (!tour) return;
    await addHotspot(tour.id, sceneId, {
      type: "info",
      yaw: 0,
      pitch: 0,
      title: "Info",
      text: "Click edit to change this text.",
    });
    await load();
  }

  async function handleCreateAndPlaceSceneHotspot(
    sceneId: string,
    targetSceneId: string,
    yaw: number,
    pitch: number,
  ) {
    if (!tour) return;
    await addHotspot(tour.id, sceneId, {
      type: "scene",
      yaw,
      pitch,
      targetSceneId,
    });
    await load();
  }

  async function handleCreateAndPlaceInfoHotspot(
    sceneId: string,
    yaw: number,
    pitch: number,
  ) {
    if (!tour) return;
    await addHotspot(tour.id, sceneId, {
      type: "info",
      yaw,
      pitch,
      title: "Info",
      text: "Click edit to change this text.",
    });
    await load();
  }

  async function handleDeleteHotspot(sceneId: string, hotspotId: string) {
    if (!tour) return;
    await deleteHotspot(tour.id, sceneId, hotspotId);
    await load();
  }

  async function handleUpdateHotspot(
    sceneId: string,
    hotspotId: string,
    patch: Partial<Hotspot>,
  ) {
    if (!tour) return;
    await fetch(
      `/api/tours/${tour.id}/scenes/${sceneId}/hotspots/${hotspotId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    await load();
  }

  if (loading || !tour) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500">{error ?? "Loading…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <input
              className="text-lg font-semibold bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
              defaultValue={tour.name}
              key={`name-${tour.name}`}
              onBlur={async (e) => {
                if (e.target.value && e.target.value !== tour.name) {
                  await updateTour(tour.id, { name: e.target.value });
                }
              }}
            />
            <input
              className="text-sm text-zinc-500 dark:text-zinc-400 bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
              defaultValue={tour.description}
              placeholder="Add a description…"
              key={`desc-${tour.description}`}
              onBlur={async (e) => {
                if (e.target.value !== tour.description) {
                  await updateTour(tour.id, { description: e.target.value });
                }
              }}
            />
          </div>
          <Link to={`/tour/${tour.id}`} target="_blank">
            <Button variant="default" size="sm" className="gap-1.5">
              <Eye className="w-4 h-4" /> Preview tour
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-semibold">Scenes ({tour.scenes.length})</h2>
              <span className="text-xs text-zinc-500">
                Drag-and-drop or click to upload. Insta360 X3 5.7K/4K equirectangular images work best.
              </span>
            </div>
            <label
              className="block border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleUpload(e.dataTransfer.files);
              }}
            >
              <Upload className="w-7 h-7 mx-auto text-zinc-400" />
              <p className="mt-2 text-sm font-medium">
                {uploading ? "Uploading…" : "Drop 360° images here, or click to browse"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Equirectangular JPG/PNG · 2:1 aspect ratio
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </label>
          </CardContent>
        </Card>

        {tour.scenes.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <ImageIcon className="w-10 h-10 mx-auto text-zinc-400" />
              <p className="mt-3 font-medium">No scenes yet</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Upload your first 360° image to start building the tour.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tour.scenes.map((scene, idx) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={idx}
                totalScenes={tour.scenes.length}
                allScenes={tour.scenes}
                onDelete={() => handleDeleteScene(scene.id)}
                onMoveUp={() => handleReorder(scene.id, -1)}
                onMoveDown={() => handleReorder(scene.id, 1)}
                onAddSceneHotspot={(targetId) => handleAddSceneHotspot(scene.id, targetId)}
                onAddInfoHotspot={() => handleAddInfoHotspot(scene.id)}
                onCreateAndPlaceSceneHotspot={(targetId, yaw, pitch) =>
                  handleCreateAndPlaceSceneHotspot(scene.id, targetId, yaw, pitch)
                }
                onCreateAndPlaceInfoHotspot={(yaw, pitch) =>
                  handleCreateAndPlaceInfoHotspot(scene.id, yaw, pitch)
                }
                onDeleteHotspot={(hotspotId) => handleDeleteHotspot(scene.id, hotspotId)}
                onUpdateHotspot={(hotspotId, patch) => handleUpdateHotspot(scene.id, hotspotId, patch)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

import React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  X,
  Compass,
  Home,
  RotateCcw,
  Plus,
  Minus,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { getTour, imageUrl } from "@/lib/api";
import type { Tour, Hotspot } from "@/lib/types";

// Marzipano types - declare as global to avoid TS issues
declare global {
  interface Window {
    Marzipano: any;
  }
}

class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("TourViewer error:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white p-6">
          <div className="text-center max-w-lg">
            <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
            <p className="mt-3 text-lg font-medium">Viewer error</p>
            <pre className="mt-2 text-xs text-left bg-zinc-900 p-3 rounded overflow-auto max-h-40">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
            <Link to="/" className="text-blue-400 text-sm mt-3 inline-block">
              ← Back to home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TourViewerWrapped() {
  return (
    <ViewerErrorBoundary>
      <TourViewer />
    </ViewerErrorBoundary>
  );
}

export function TourViewer() {
  const { id } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<any>(null);
  const viewerRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const sceneMapRef = useRef<Map<string, any>>(new Map());
  const [tour, setTour] = useState<Tour | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [yawHfov, setYawHfov] = useState({ yaw: 0, hfov: 90, pitch: 0 });
  const [marzipanoReady, setMarzipanoReady] = useState(
    typeof window !== "undefined" && !!window.Marzipano,
  );

  // Load tour
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTour(id)
      .then(setTour)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  // Load Marzipano script
  useEffect(() => {
    if (window.Marzipano) {
      setMarzipanoReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "/marzipano.js";
    script.async = true;
    script.onload = () => setMarzipanoReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize viewer
  useEffect(() => {
    if (!tour || !containerRef.current || !window.Marzipano) return;
    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    const viewer = new window.Marzipano.Viewer(containerRef.current, {
      controls: { mouseViewMode: "drag" },
    });
    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [tour, marzipanoReady]);

  // Switch to current scene (creating it on demand, then caching)
  useEffect(() => {
    if (!tour || !viewerRef.current || !marzipanoReady) return;
    const scene = tour.scenes[sceneIdx];
    if (!scene) return;

    const viewer = viewerRef.current;
    let marzipanoScene = sceneMapRef.current.get(scene.id);

    if (!marzipanoScene) {
      const source = window.Marzipano.ImageUrlSource.fromString(
        imageUrl(scene.file),
      );

      // Cap texture to 4K; Insta360 X3 stitches to 5.7K but 4K is a good balance
      const geometry = new window.Marzipano.EquirectGeometry([
        { width: 4096 },
      ]);

      const limiter = new window.Marzipano.RectilinearView.limit.traditional(
        1024,
        (100 * Math.PI) / 180,
      );
      const initialView = new window.Marzipano.RectilinearView(
        {
          yaw: scene.initialYaw ?? 0,
          pitch: scene.initialPitch ?? 0,
          fov: ((scene.initialHfov ?? 90) * Math.PI) / 180,
        },
        limiter,
      );

      marzipanoScene = viewer.createScene({
        source,
        geometry,
        view: initialView,
        pinFirstLevel: true,
      });

      // Add hotspots (only when scene is first created)
      scene.hotspots.forEach((h) => {
        let el: HTMLElement;
        if (h.type === "scene") {
          el = createSceneHotspotEl(h, () => {
            const targetIdx = tour.scenes.findIndex(
              (s) => s.id === h.targetSceneId,
            );
            if (targetIdx >= 0) setSceneIdx(targetIdx);
          });
        } else {
          el = createInfoHotspotEl(h);
        }
        marzipanoScene.hotspotContainer().createHotspot(el, {
          yaw: h.yaw,
          pitch: h.pitch,
        });
      });

      sceneMapRef.current.set(scene.id, marzipanoScene);
    }

    sceneRef.current = marzipanoScene;
    // Reset view to scene's initial parameters each time we switch
    marzipanoScene.view().setParameters({
      yaw: scene.initialYaw ?? 0,
      pitch: scene.initialPitch ?? 0,
      fov: ((scene.initialHfov ?? 90) * Math.PI) / 180,
    });
    marzipanoScene.switchTo({ transitionDuration: 600 });

    // Track yaw/hfov for HUD
    const updateHud = () => {
      const v = marzipanoScene.view();
      setYawHfov({
        yaw: (v.yaw() * 180) / Math.PI,
        hfov: (v.fov() * 180) / Math.PI,
        pitch: (v.pitch() * 180) / Math.PI,
      });
    };
    updateHud();
    const onChange = marzipanoScene.view().addEventListener("change", updateHud);

    return () => {
      onChange?.remove?.();
    };
  }, [tour, sceneIdx, marzipanoReady]);

  // Fullscreen handling
  useEffect(() => {
    function onFs() {
      setIsFs(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  function resetView() {
    const v = sceneRef.current?.view();
    const scene = tour?.scenes[sceneIdx];
    if (!v || !scene) return;
    v.setParameters({
      yaw: scene.initialYaw ?? 0,
      pitch: scene.initialPitch ?? 0,
      fov: (scene.initialHfov ?? 90) * (Math.PI / 180),
    });
  }

  function zoom(delta: number) {
    const v = sceneRef.current?.view();
    if (!v) return;
    const cur = v.fov();
    v.fov(Math.max(Math.PI / 12, Math.min(Math.PI, cur + delta)));
  }

  function rotate(yawDelta: number) {
    const v = sceneRef.current?.view();
    if (!v) return;
    v.yaw(v.yaw() + yawDelta);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-zinc-400">Loading tour…</p>
        </div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white p-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-medium">Could not load tour</p>
          <p className="text-sm text-zinc-400 mt-1">{error}</p>
          <Link to="/" className="text-blue-400 text-sm mt-3 inline-block">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (tour.scenes.length === 0) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white p-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-medium">This tour has no scenes yet</p>
          <Link to={`/admin/${tour.id}`} className="text-blue-400 text-sm mt-3 inline-block">
            Add scenes →
          </Link>
        </div>
      </div>
    );
  }

  const currentScene = tour.scenes[sceneIdx];
  const compassDeg = ((yawHfov.yaw % 360) + 360) % 360;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white overflow-hidden">
      {/* Pano container */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ cursor: "grab" }}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex items-start justify-between p-4 gap-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur transition-colors"
              title="Home"
            >
              <Home className="w-4 h-4" />
            </Link>
            <div className="bg-black/60 backdrop-blur rounded-full px-3 py-1.5 text-sm font-medium max-w-[60vw] truncate">
              {tour.name}
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setShowMap(!showMap)}
              className={`flex items-center justify-center w-9 h-9 rounded-full backdrop-blur transition-colors ${
                showMap
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-black/60 hover:bg-black/80"
              }`}
              title="Scene list"
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur transition-colors"
              title="Fullscreen"
            >
              {isFs ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="p-4 flex items-end justify-between gap-4">
          {/* Scene title / drawer */}
          <div className="pointer-events-auto flex-1 max-w-md">
            <div
              className={`bg-black/70 backdrop-blur rounded-2xl overflow-hidden transition-all ${
                drawerOpen ? "" : "rounded-full"
              }`}
            >
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
              >
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-sm flex-1 truncate">
                  {currentScene.name}
                </span>
                <span className="text-xs text-zinc-400">
                  {sceneIdx + 1}/{tour.scenes.length}
                </span>
                {drawerOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
              {drawerOpen && (
                <div className="border-t border-white/10">
                  {tour.description && (
                    <p className="px-4 py-2 text-xs text-zinc-300">
                      {tour.description}
                    </p>
                  )}
                  {tour.scenes.length > 1 && (
                    <div className="max-h-48 overflow-y-auto px-1 py-1">
                      {tour.scenes.map((s, i) => (
                        <button
                          key={s.id}
                          onClick={() => setSceneIdx(i)}
                          className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            i === sceneIdx
                              ? "bg-white/15"
                              : "hover:bg-white/10"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right controls: compass, zoom, reset */}
          <div className="pointer-events-auto flex flex-col gap-2">
            <button
              onClick={resetView}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur transition-colors"
              title="Reset view"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="bg-black/60 backdrop-blur rounded-full flex flex-col items-center">
              <button
                onClick={() => zoom(-Math.PI / 18)}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-t-full"
                title="Zoom in"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="h-px bg-white/10 w-6" />
              <button
                onClick={() => zoom(Math.PI / 18)}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-b-full"
                title="Zoom out"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
            {/* Compass */}
            <div
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur relative overflow-hidden cursor-pointer"
              onClick={() => rotate(-yawHfov.yaw * (Math.PI / 180))}
              title="Reset to north"
            >
              <div
                className="absolute inset-0 transition-transform duration-200"
                style={{ transform: `rotate(${-compassDeg}deg)` }}
              >
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-red-500" />
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-zinc-400">
                  S
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-[9px] text-zinc-500 pointer-events-none">
                N
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini-map / scene panel */}
      {showMap && (
        <div className="absolute top-16 right-4 z-20 pointer-events-auto w-72 max-h-[calc(100vh-200px)] bg-black/80 backdrop-blur rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
            <span className="text-sm font-medium">All scenes</span>
            <button
              onClick={() => setShowMap(false)}
              className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-y-auto p-2">
            {tour.scenes.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  setSceneIdx(i);
                  setShowMap(false);
                }}
                className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${
                  i === sceneIdx
                    ? "bg-blue-600/30 ring-1 ring-blue-500"
                    : "hover:bg-white/10"
                }`}
              >
                <img
                  src={imageUrl(s.file)}
                  alt=""
                  className="w-14 h-7 object-cover rounded flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-[11px] text-zinc-400">
                    {s.hotspots.filter((h) => h.type === "scene").length} links ·{" "}
                    {s.hotspots.filter((h) => h.type === "info").length} info
                  </p>
                </div>
                <span className="text-[10px] text-zinc-500">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state for first scene load */}
      <div className="sr-only">360 tour</div>
    </div>
  );
}

function createSceneHotspotEl(h: Hotspot, onClick: () => void): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className =
    "hotspot-scene group relative flex flex-col items-center cursor-pointer";
  wrapper.innerHTML = `
    <div class="w-12 h-12 rounded-full bg-white/95 backdrop-blur shadow-lg ring-2 ring-blue-500/60 flex items-center justify-center group-hover:scale-110 transition-transform">
      <svg class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M13 5l7 7-7 7"/>
      </svg>
    </div>
    <div class="absolute top-full mt-2 px-2 py-1 rounded-md bg-black/80 text-white text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
      Move here
    </div>
  `;
  wrapper.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return wrapper;
}

function createInfoHotspotEl(h: Hotspot): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "hotspot-info group relative cursor-pointer";
  wrapper.innerHTML = `
    <div class="w-9 h-9 rounded-full bg-amber-500 shadow-lg ring-2 ring-white/80 flex items-center justify-center group-hover:scale-110 transition-transform">
      <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    </div>
    <div class="hotspot-info-popover absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 max-w-[70vw] p-3 rounded-lg bg-black/85 text-white text-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
      <p class="font-semibold text-sm mb-1"></p>
      <p class="text-zinc-200 leading-relaxed"></p>
    </div>
  `;
  const popover = wrapper.querySelector(".hotspot-info-popover") as HTMLElement;
  popover.querySelector("p.font-semibold")!.textContent = h.title || "Info";
  popover.querySelector("p.text-zinc-200")!.textContent =
    h.text || "Click to learn more.";
  return wrapper;
}

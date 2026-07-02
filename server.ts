import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";
import { mkdir, readdir, unlink, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

// AI agents: read README.md for navigation and contribution guidance.
type Mode = "development" | "production";
const app = new Hono();

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

const DATA_DIR = resolve("./data");
const UPLOADS_DIR = join(DATA_DIR, "uploads");
const TOURS_FILE = join(DATA_DIR, "tours.json");

// Types
type Hotspot = {
  id: string;
  type: "scene" | "info";
  // scene hotspots:
  targetSceneId?: string;
  // info hotspots:
  title?: string;
  text?: string;
  // yaw/pitch in radians
  yaw: number;
  pitch: number;
};

type Scene = {
  id: string;
  name: string;
  file: string; // relative path under uploads e.g. "tourId/sceneId.jpg"
  initialYaw?: number;
  initialPitch?: number;
  initialHfov?: number;
  hotspots: Hotspot[];
};

type Tour = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  scenes: Scene[];
};

async function ensureDirs() {
  await mkdir(UPLOADS_DIR, { recursive: true });
  if (!existsSync(TOURS_FILE)) {
    await Bun.write(TOURS_FILE, JSON.stringify({ tours: [] }, null, 2));
  }
}
await ensureDirs();

async function readTours(): Promise<Tour[]> {
  const file = Bun.file(TOURS_FILE);
  if (!(await file.exists())) return [];
  const text = await file.text();
  if (!text.trim()) return [];
  try {
    const data = JSON.parse(text) as { tours: Tour[] };
    return data.tours || [];
  } catch {
    return [];
  }
}

async function writeTours(tours: Tour[]) {
  await Bun.write(TOURS_FILE, JSON.stringify({ tours }, null, 2));
}

function safeTourId(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// ============ API ROUTES ============

// List all tours (public, returns summary)
app.get("/api/tours", async (c) => {
  const tours = await readTours();
  return c.json({
    tours: tours.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      sceneCount: t.scenes.length,
      firstScene: t.scenes[0] ? { id: t.scenes[0].id, name: t.scenes[0].name } : null,
    })),
  });
});

// Get a single tour with all scenes & hotspots
app.get("/api/tours/:id", async (c) => {
  const id = c.req.param("id");
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  return c.json({ tour });
});

// Create a new tour
app.post("/api/tours", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
  };
  const name = (body.name || "").trim();
  if (!name) return c.json({ error: "Name is required" }, 400);
  const id = safeTourId(name) + "-" + randomUUID().slice(0, 6);
  const tour: Tour = {
    id,
    name,
    description: (body.description || "").trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    scenes: [],
  };
  const tours = await readTours();
  tours.push(tour);
  await writeTours(tours);
  await mkdir(join(UPLOADS_DIR, id), { recursive: true });
  return c.json({ tour }, 201);
});

// Update tour metadata (name, description)
app.patch("/api/tours/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
  };
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  if (body.name !== undefined) tour.name = String(body.name).trim() || tour.name;
  if (body.description !== undefined) tour.description = String(body.description);
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ tour });
});

// Delete a tour
app.delete("/api/tours/:id", async (c) => {
  const id = c.req.param("id");
  const tours = await readTours();
  const idx = tours.findIndex((t) => t.id === id);
  if (idx === -1) return c.json({ error: "Tour not found" }, 404);
  tours.splice(idx, 1);
  await writeTours(tours);
  // remove uploads
  const dir = join(UPLOADS_DIR, id);
  if (existsSync(dir)) {
    const files = await readdir(dir);
    for (const f of files) await unlink(join(dir, f)).catch(() => {});
  }
  return c.json({ ok: true });
});

// Upload a 360 image to a tour (creates a scene)
app.post("/api/tours/:id/scenes", async (c) => {
  const id = c.req.param("id");
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);

  const form = await c.req.formData();
  const file = form.get("image");
  const name = (form.get("name") as string | null) || "";
  if (!file || !(file instanceof File)) {
    return c.json({ error: "image file is required" }, 400);
  }

  const ext = (extname(file.name).toLowerCase() || ".jpg").replace(".", "");
  const allowed = ["jpg", "jpeg", "png", "webp"];
  if (!allowed.includes(ext)) {
    return c.json({ error: `Unsupported image type .${ext}. Use jpg/jpeg/png/webp.` }, 400);
  }

  const sceneId = randomUUID();
  const dir = join(UPLOADS_DIR, id);
  await mkdir(dir, { recursive: true });
  const fileName = `${sceneId}.${ext}`;
  const filePath = join(dir, fileName);
  await Bun.write(filePath, file);

  const scene: Scene = {
    id: sceneId,
    name: name.trim() || `Scene ${tour.scenes.length + 1}`,
    file: `${id}/${fileName}`,
    initialYaw: 0,
    initialPitch: 0,
    initialHfov: 120,
    hotspots: [],
  };
  tour.scenes.push(scene);
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ scene }, 201);
});

// Update scene metadata (name, initial view)
app.patch("/api/tours/:id/scenes/:sceneId", async (c) => {
  const id = c.req.param("id");
  const sceneId = c.req.param("sceneId");
  const body = (await c.req.json().catch(() => ({}))) as Partial<Scene>;
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  const scene = tour.scenes.find((s) => s.id === sceneId);
  if (!scene) return c.json({ error: "Scene not found" }, 404);
  if (body.name !== undefined) scene.name = String(body.name).trim() || scene.name;
  if (typeof body.initialYaw === "number") scene.initialYaw = body.initialYaw;
  if (typeof body.initialPitch === "number") scene.initialPitch = body.initialPitch;
  if (typeof body.initialHfov === "number") scene.initialHfov = body.initialHfov;
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ scene });
});

// Delete a scene
app.delete("/api/tours/:id/scenes/:sceneId", async (c) => {
  const id = c.req.param("id");
  const sceneId = c.req.param("sceneId");
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  const idx = tour.scenes.findIndex((s) => s.id === sceneId);
  if (idx === -1) return c.json({ error: "Scene not found" }, 404);
  const [removed] = tour.scenes.splice(idx, 1);
  // remove hotspots pointing to this scene
  for (const s of tour.scenes) {
    s.hotspots = s.hotspots.filter((h) => h.targetSceneId !== sceneId);
  }
  // remove file
  const filePath = join(UPLOADS_DIR, removed.file);
  await unlink(filePath).catch(() => {});
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ ok: true });
});

// Reorder scenes
app.post("/api/tours/:id/scenes/reorder", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { order?: string[] };
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  const order = body.order || [];
  const map = new Map(tour.scenes.map((s) => [s.id, s]));
  const next: Scene[] = [];
  for (const sid of order) {
    const s = map.get(sid);
    if (s) next.push(s);
  }
  // append any not in order list
  for (const s of tour.scenes) if (!order.includes(s.id)) next.push(s);
  tour.scenes = next;
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ scenes: tour.scenes });
});

// Add a hotspot to a scene
app.post("/api/tours/:id/scenes/:sceneId/hotspots", async (c) => {
  const id = c.req.param("id");
  const sceneId = c.req.param("sceneId");
  const body = (await c.req.json().catch(() => ({}))) as Partial<Hotspot>;
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  const scene = tour.scenes.find((s) => s.id === sceneId);
  if (!scene) return c.json({ error: "Scene not found" }, 404);
  if (body.type !== "scene" && body.type !== "info") {
    return c.json({ error: "Invalid hotspot type" }, 400);
  }
  if (body.type === "scene" && body.targetSceneId) {
    if (!tour.scenes.find((s) => s.id === body.targetSceneId)) {
      return c.json({ error: "Target scene not found in this tour" }, 400);
    }
  }
  const hs: Hotspot = {
    id: randomUUID(),
    type: body.type,
    yaw: Number(body.yaw) || 0,
    pitch: Number(body.pitch) || 0,
    targetSceneId: body.targetSceneId,
    title: body.title,
    text: body.text,
  };
  scene.hotspots.push(hs);
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ hotspot: hs }, 201);
});

// Update hotspot
app.patch("/api/tours/:id/scenes/:sceneId/hotspots/:hotspotId", async (c) => {
  const id = c.req.param("id");
  const sceneId = c.req.param("sceneId");
  const hotspotId = c.req.param("hotspotId");
  const body = (await c.req.json().catch(() => ({}))) as Partial<Hotspot>;
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  const scene = tour.scenes.find((s) => s.id === sceneId);
  if (!scene) return c.json({ error: "Scene not found" }, 404);
  const hs = scene.hotspots.find((h) => h.id === hotspotId);
  if (!hs) return c.json({ error: "Hotspot not found" }, 404);
  if (typeof body.yaw === "number") hs.yaw = body.yaw;
  if (typeof body.pitch === "number") hs.pitch = body.pitch;
  if (body.title !== undefined) hs.title = body.title;
  if (body.text !== undefined) hs.text = body.text;
  if (body.type === "scene" || body.type === "info") hs.type = body.type;
  if (body.targetSceneId !== undefined) hs.targetSceneId = body.targetSceneId;
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ hotspot: hs });
});

// Delete hotspot
app.delete("/api/tours/:id/scenes/:sceneId/hotspots/:hotspotId", async (c) => {
  const id = c.req.param("id");
  const sceneId = c.req.param("sceneId");
  const hotspotId = c.req.param("hotspotId");
  const tours = await readTours();
  const tour = tours.find((t) => t.id === id);
  if (!tour) return c.json({ error: "Tour not found" }, 404);
  const scene = tour.scenes.find((s) => s.id === sceneId);
  if (!scene) return c.json({ error: "Scene not found" }, 404);
  const idx = scene.hotspots.findIndex((h) => h.id === hotspotId);
  if (idx === -1) return c.json({ error: "Hotspot not found" }, 404);
  scene.hotspots.splice(idx, 1);
  tour.updatedAt = Date.now();
  await writeTours(tours);
  return c.json({ ok: true });
});

// Serve uploaded images
app.get("/uploads/:tourId/:file", async (c) => {
  const tourId = c.req.param("tourId");
  const file = c.req.param("file");
  // prevent path traversal
  if (tourId.includes("/") || tourId.includes("..") || file.includes("/") || file.includes("..")) {
    return c.text("Not found", 404);
  }
  const filePath = join(UPLOADS_DIR, tourId, file);
  if (!existsSync(filePath)) return c.text("Not found", 404);
  const f = Bun.file(filePath);
  const stat = await f.stat();
  if (!stat || stat.isDirectory()) return c.text("Not found", 404);
  return new Response(f, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
});

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

function configureProduction(app: Hono) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();

    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/") || path.startsWith("/uploads/")) return next();

    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) {
        return new Response(file);
      }
    }

    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
}

async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path.startsWith("/uploads/")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, {
          headers: { "Cache-Control": "no-store, must-revalidate" },
        });
      }

      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, {
            headers: { "Cache-Control": "no-store, must-revalidate" },
          });
        }
      }

      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }

      if (result) {
        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate",
          },
        });
      }

      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, {
        headers: { "Cache-Control": "no-store, must-revalidate" },
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}

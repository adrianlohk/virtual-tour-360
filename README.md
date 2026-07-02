# Virtual Tour 360

A web platform for building and sharing 360° virtual tours from Insta360 X3 images (or any equirectangular 360° photo). Drop your images in, link rooms together with hotspots, and share an immersive Google Street View-style experience with anyone.

## What it does

- **Upload** equirectangular 360° images (JPG/PNG/WebP, 2:1 aspect ratio — Insta360 X3's native output)
- **Auto-create** one scene per uploaded image
- **Link scenes** together with scene-to-scene hotspots (the iconic "arrow" you click to walk into the next room)
- **Add info hotspots** anywhere on the panorama to label features ("Reception desk", "3D model", etc.)
- **Visitor viewing page** with Google Street View-style controls (drag to look, scroll/pinch to zoom, mini-map, fullscreen, scene list)
- **Admin editor** with click-to-place hotspots, scene reordering, and live preview

## How to use

1. Open the site and click **New tour**
2. Give it a name and optional description
3. From the editor, **drop 360° images** onto the upload area (or click to browse)
4. For each scene, click **Add hotspot → Link to scene…** to create arrows that jump to other scenes
5. Click **Add hotspot → Info hotspot** to add labeled info points
6. Click any hotspot's pencil icon, then click the equirectangular preview to position it on the image
7. Click **Preview tour** to open the visitor view

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + shadcn-style UI primitives
- **Backend:** Bun + Hono (file-based JSON store, no database setup)
- **360° viewer:** [Marzipano](https://www.marzipano.net/) by Google — same engine used by Google Street View
- **Storage:** `data/tours.json` for tour/scene/hotspot metadata, `data/uploads/<tourId>/` for image files

## File structure

```
src/
├── pages/
│   ├── home.tsx          # Tour list + create form
│   ├── admin.tsx         # Tour editor (uploads, scene list, hotspot mgmt)
│   └── tour-viewer.tsx   # 360° visitor view (Google Street View UX)
├── components/
│   ├── scene-card.tsx    # Per-scene editor with equirectangular hotspot placement
│   └── ui/               # shadcn-style Button, Card, Badge
├── lib/
│   ├── api.ts            # Typed fetch helpers
│   └── types.ts          # Shared types (Tour, Scene, Hotspot)
server.ts                 # Hono API + Vite middleware
public/marzipano.js       # Marzipano UMD bundle
data/                     # Persisted tours + uploaded images
```

## Architecture notes

### Scene switching
Marzipano expects scenes to be created once and switched with `scene.switchTo()`. We pre-create all scenes on tour load and keep them alive — clicking a hotspot just calls `switchTo` on the target scene. This avoids Marzipano's stage/layer teardown bugs.

### Viewer UX
The visitor view (`src/pages/tour-viewer.tsx`) follows the Google Street View idiom:
- Black chrome, full-bleed panorama canvas
- Top bar: tour name + home/scene-list/fullscreen buttons
- Bottom-left: scene title + collapsible scene drawer
- Bottom-right: reset/zoom/compass controls
- Click-and-drag to look around, scroll wheel to zoom

### Hotspot placement in the editor
The admin editor shows each scene's equirectangular preview at 2:1 aspect. Click coordinates map to spherical yaw/pitch:
- `x: 0..1` → `yaw: 0..2π`
- `y: 0..1` → `pitch: 0.5π .. -0.5π`

This matches Marzipano's coordinate system, so editor positions match the visitor view 1:1.

### Image constraints
- Texture is capped at 4096px wide for memory. Insta360 X3 stitches to 5760x2880 (5.7K); 4K is a good balance of quality and load time.
- Future improvement: multi-resolution tiling for very large images (Marzipano supports cube-map and equirectangular multi-level sources).

## API endpoints

- `GET  /api/tours` — list all tours (summary)
- `GET  /api/tours/:id` — full tour with scenes & hotspots
- `POST /api/tours` — create tour
- `PATCH /api/tours/:id` — update name/description
- `DELETE /api/tours/:id` — delete tour + its images
- `POST /api/tours/:id/scenes` — upload a 360 image (multipart `image` + `name`)
- `PATCH /api/tours/:id/scenes/:sceneId` — update scene name/initial view
- `DELETE /api/tours/:id/scenes/:sceneId` — delete scene + image
- `POST /api/tours/:id/scenes/reorder` — `{ order: string[] }`
- `POST /api/tours/:id/scenes/:sceneId/hotspots` — add hotspot
- `PATCH /api/tours/:id/scenes/:sceneId/hotspots/:hotspotId` — update hotspot
- `DELETE /api/tours/:id/scenes/:sceneId/hotspots/:hotspotId` — delete hotspot
- `GET  /uploads/:tourId/:file` — serve uploaded images

## Development

- Dev server is managed by Zo (`bun run dev`). Do not start it manually.
- Hot reload is disabled (HMR off) — the dev server picks up file changes on next request via Vite middleware.
- View logs at `/dev/shm/zosite-53935.log` (server) and `/dev/shm/zosite-53935-proxy.log` (requests).
- For UI debugging, use `agent-browser open http://localhost:53935` from the project directory.

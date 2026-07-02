import type { Tour, TourSummary } from "./types";

const BASE = "";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {}
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listTours(): Promise<TourSummary[]> {
  const res = await fetch(`${BASE}/api/tours`);
  const data = await jsonOrThrow<{ tours: TourSummary[] }>(res);
  return data.tours;
}

export async function getTour(id: string): Promise<Tour> {
  const res = await fetch(`${BASE}/api/tours/${id}`);
  const data = await jsonOrThrow<{ tour: Tour }>(res);
  return data.tour;
}

export async function createTour(name: string, description: string): Promise<Tour> {
  const res = await fetch(`${BASE}/api/tours`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  const data = await jsonOrThrow<{ tour: Tour }>(res);
  return data.tour;
}

export async function updateTour(
  id: string,
  patch: { name?: string; description?: string },
): Promise<Tour> {
  const res = await fetch(`${BASE}/api/tours/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await jsonOrThrow<{ tour: Tour }>(res);
  return data.tour;
}

export async function deleteTour(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/tours/${id}`, { method: "DELETE" });
  await jsonOrThrow<{ ok: true }>(res);
}

export async function uploadScene(
  tourId: string,
  file: File,
  name: string,
): Promise<Tour> {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("name", name);
  const res = await fetch(`${BASE}/api/tours/${tourId}/scenes`, {
    method: "POST",
    body: fd,
  });
  const data = await jsonOrThrow<{ scene: unknown }>(res);
  // Re-fetch whole tour to keep state in sync
  return await getTour(tourId);
}

export async function updateScene(
  tourId: string,
  sceneId: string,
  patch: { name?: string; initialYaw?: number; initialPitch?: number; initialHfov?: number },
): Promise<void> {
  const res = await fetch(`${BASE}/api/tours/${tourId}/scenes/${sceneId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  await jsonOrThrow(res);
}

export async function deleteScene(tourId: string, sceneId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/tours/${tourId}/scenes/${sceneId}`, { method: "DELETE" });
  await jsonOrThrow(res);
}

export async function reorderScenes(tourId: string, order: string[]): Promise<void> {
  const res = await fetch(`${BASE}/api/tours/${tourId}/scenes/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
  await jsonOrThrow(res);
}

export async function addHotspot(
  tourId: string,
  sceneId: string,
  hs: { type: "scene" | "info"; yaw: number; pitch: number; targetSceneId?: string; title?: string; text?: string },
): Promise<void> {
  const res = await fetch(`${BASE}/api/tours/${tourId}/scenes/${sceneId}/hotspots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hs),
  });
  await jsonOrThrow(res);
}

export async function updateHotspot(
  tourId: string,
  sceneId: string,
  hotspotId: string,
  patch: { yaw?: number; pitch?: number; title?: string; text?: string; type?: "scene" | "info"; targetSceneId?: string },
): Promise<void> {
  const res = await fetch(
    `${BASE}/api/tours/${tourId}/scenes/${sceneId}/hotspots/${hotspotId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  await jsonOrThrow(res);
}

export async function deleteHotspot(
  tourId: string,
  sceneId: string,
  hotspotId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/api/tours/${tourId}/scenes/${sceneId}/hotspots/${hotspotId}`,
    { method: "DELETE" },
  );
  await jsonOrThrow(res);
}

export function imageUrl(file: string): string {
  return `${BASE}/uploads/${file}`;
}

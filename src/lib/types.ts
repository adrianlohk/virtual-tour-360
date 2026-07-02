export type Hotspot = {
  id: string;
  type: "scene" | "info";
  yaw: number;
  pitch: number;
  targetSceneId?: string;
  title?: string;
  text?: string;
};

export type Scene = {
  id: string;
  name: string;
  file: string;
  initialYaw?: number;
  initialPitch?: number;
  initialHfov?: number;
  hotspots: Hotspot[];
};

export type Tour = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  scenes: Scene[];
};

export type TourSummary = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  sceneCount: number;
  firstScene: { id: string; name: string } | null;
};

import type { CarPart } from '../domain/types';
// Renderer-only contract. Replace null with versioned GLB asset paths when Blender assets exist.
// No geometry or rendering dependency enters the sporting simulation.
export const carAssetManifest: Record<CarPart, { model: string | null }> = {
  CarModel: { model: null },
  FrontWing: { model: null },
  RearWing: { model: null },
  Floor: { model: null },
  Sidepod: { model: null },
  Wheels: { model: null },
  Suspension: { model: null },
  Cockpit: { model: null },
  Livery: { model: null },
  Battery: { model: null },
  Engine: { model: null },
};

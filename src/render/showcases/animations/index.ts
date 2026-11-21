// Showcases for player and world animations, keyed by asset id. Each one plays live with &play.
// Each showcase lives in its own file in this folder, and registry.ts lists them. The list of every family is src/render/showcases/index.ts.
import type { Showcase } from "../types";
import * as REGISTRY from "./registry";

export const ANIMATIONS_SHOWCASES: Readonly<Record<string, Showcase>> = { ...REGISTRY };

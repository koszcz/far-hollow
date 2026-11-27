// Showcases for the sawhorse and the sled, empty and loaded.
import { setComponent } from "../../sim/entities";
import { BUILD_FADE_SHARE } from "../structure-look";
import { SAWHORSE_LOG_COST } from "../../sim/structure-camp";
import { SLED_LOG_COST, SLED_STICK_COST } from "../../sim/structure-freely-placed";
import type { Showcase } from "./types";

/** A sled is built in one stage per log and one per stick. */
const SLED_STAGES = SLED_LOG_COST + SLED_STICK_COST;

export const SLED_SHOWCASES: Readonly<Record<string, Showcase>> = {
  sawhorse: {
    radius: 1.6,
    focus: { x: 0, y: 0.35, z: 0 },
    // A blueprint with one log delivered, the beam being set down, then the finished sawhorse from the side and from one end.
    shots: [
      { label: "blueprint, 1 of 2 logs delivered", yaw: 30, pitch: 30, seconds: 0 },
      { label: "beam above its place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / SAWHORSE_LOG_COST },
      { label: "built, side", yaw: 0, pitch: 12, seconds: 1 },
      { label: "built, end", yaw: 90, pitch: 20, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { blueprint: { structure: "sawhorse", progress: 0, materialsSpent: 0, delivered: { debarkedLog: 1 } }, facing: { turns: 0 } });
      movePlayer(1.3, 0.3, -Math.PI / 2);
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
  },
  sled: {
    radius: 1.8,
    focus: { x: 0, y: 0.15, z: 0 },
    // A blueprint with one log delivered, the second runner being set down, a cross piece being laid,
    // then the finished sled from above, loaded with 4 logs and 2 debarked logs.
    shots: [
      { label: "blueprint, 1 of 2 logs delivered", yaw: 30, pitch: 30, seconds: 0 },
      { label: "second runner above its place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / SLED_STAGES },
      { label: "a cross piece above its place", yaw: 30, pitch: 30, seconds: (3 + BUILD_FADE_SHARE) / SLED_STAGES },
      { label: "built, with 4 logs and 2 debarked logs, from above", yaw: 140, pitch: 50, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { blueprint: { structure: "sled", progress: 0, materialsSpent: 0, delivered: { log: 1 } }, facing: { turns: 0 } });
      movePlayer(0.3, 1, Math.PI);
    },
    pose({ store }, shot) {
      const progress = shot.seconds ?? 0;
      for (const entity of [...store.with("facing").entities]) {
        if (entity.blueprint?.structure !== "sled" && entity.sled === undefined) continue;
        // A finished sled shows its load. Before then it is a blueprint being built.
        if (progress >= 1) {
          store.removeComponent(entity, "blueprint");
          setComponent(store, entity, "sled", { log: 4, debarkedLog: 2, plank: 0 });
        } else {
          store.removeComponent(entity, "sled");
          setComponent(store, entity, "blueprint", { structure: "sled", progress, materialsSpent: 0, delivered: { log: 1 } });
        }
      }
    },
  },
  "sled-planks": {
    radius: 1.8,
    focus: { x: 0, y: 0.15, z: 0 },
    // A finished sled with a few loose planks, two lashed layers seen low from the side, a full load of 24 planks,
    // and planks on top of logs. `seconds` picks the load.
    shots: [
      { label: "5 planks, loose", yaw: 30, pitch: 35, seconds: 0 },
      { label: "16 planks, two lashed layers", yaw: 160, pitch: 14, seconds: 3, radius: 1.3 },
      { label: "24 planks, the most a sled holds", yaw: 30, pitch: 35, seconds: 1 },
      { label: "3 logs with 12 planks on top", yaw: 140, pitch: 30, seconds: 2 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { sled: { log: 0, debarkedLog: 0, plank: 5 }, facing: { turns: 0 } });
      movePlayer(0.3, 1, Math.PI);
    },
    pose({ store }, shot) {
      const loads = [
        { log: 0, debarkedLog: 0, plank: 5 },
        { log: 0, debarkedLog: 0, plank: 24 },
        { log: 2, debarkedLog: 1, plank: 12 },
        { log: 0, debarkedLog: 0, plank: 16 },
      ];
      const load = loads[shot.seconds ?? 0] ?? loads[0];
      for (const entity of store.with("sled")) Object.assign(entity.sled, load);
    },
  },
};

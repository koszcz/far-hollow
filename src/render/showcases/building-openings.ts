// Showcases for what hangs in a door frame or a window: the door, the shutters, their swing, and the window glow.
import { setComponent } from "../../sim/entities";
import { BUILD_FADE_SHARE } from "../structure-look";
import { DOOR_FIRST_BOUNCE_SHARE, DOOR_REBOUND_SECONDS, DOOR_SWING_SECONDS, RING_SHOVE_TAP_SECONDS } from "../door-swing";
import { DOOR_PLANK_COST, SHUTTERS_PLANK_COST } from "../../sim/structure-cabin-fittings";
import { turnOffset } from "../../sim/quarter-turns";
import { SHUTTER_FIRST_BOUNCE_SHARE, SHUTTER_KNOCK_SECONDS, SHUTTER_SWING_SECONDS } from "../shutter-swing";
import { DUSK, NIGHT, NOON, type Showcase } from "./types";
import { onDeckOf, roofOver } from "./cabin-stage";

/** In the "door-animation" live loop, the player walks from inside the cabin, this far along z, out to this far, and back, in this long. */
const DOOR_WALK_FROM_Z = -1.2;
const DOOR_WALK_TO_Z = 2.2;
const DOOR_WALK_CYCLE_SECONDS = 6;
/** In the "shutter-swing" live loop, the shutters stand open for half of this long, then closed for the other half. */
const SHUTTER_LOOP_SECONDS = 4;

export const OPENINGS_SHOWCASES: Readonly<Record<string, Showcase>> = {
  door: {
    radius: 1.5,
    focus: { x: 0, y: 1, z: 0.5 },
    // A door frame on the front edge of a foundation: a door blueprint with 1 of 3 planks, the 2nd plank being set down,
    // then the finished door, shut, from the front with its latch and from behind with its battens. The player stands aside.
    shots: [
      { label: `blueprint, 1 of ${DOOR_PLANK_COST} planks`, yaw: 25, pitch: 15, seconds: 0 },
      { label: "2nd plank above its place", yaw: 25, pitch: 15, seconds: (1 + BUILD_FADE_SHARE) / DOOR_PLANK_COST },
      { label: "built, shut, front", yaw: 0, pitch: 10, seconds: 1 },
      { label: "built, shut, back", yaw: 180, pitch: 10, seconds: 1 },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      onDeck(0, 0, { foundation: true });
      onDeck(0, 0.5, { edgePiece: "doorFrame", facing: { turns: 0 } });
      onDeck(0, 0.5, { blueprint: { structure: "door", progress: 0, materialsSpent: 0, delivered: { plank: 1 } }, facing: { turns: 0 } });
      stage.movePlayer(1.4, 1.6, -Math.PI / 2);
    },
    pose({ store }, shot) {
      const progress = shot.seconds ?? 0;
      for (const entity of [...store.with("blueprint"), ...store.with("door")]) {
        if (progress >= 1) {
          store.removeComponent(entity, "blueprint");
          setComponent(store, entity, "door", true);
          continue;
        }
        store.removeComponent(entity, "door");
        setComponent(store, entity, "blueprint", { structure: "door", progress, materialsSpent: 0, delivered: {} });
        if (entity.blueprint !== undefined) entity.blueprint.delivered.plank = Math.max(1, Math.ceil(progress * DOOR_PLANK_COST));
      }
    },
  },
  "door-animation": {
    radius: 1.8,
    focus: { x: 0, y: 1, z: 0.5 },
    // A finished door in its frame. Each view hangs a new door, so it starts to swing as the view's clock starts:
    // shoved open as the player steps up to it, with the latch ring flung off the face, standing open with the player in the
    // doorway, bouncing off the frame after it slams shut behind them, then shut.
    shots: [
      { label: "swinging open, ring flung off the face", yaw: 35, pitch: 20, seconds: RING_SHOVE_TAP_SECONDS / 2 },
      { label: "open, player in the doorway", yaw: 35, pitch: 20, seconds: 1 },
      {
        label: "slammed shut, bouncing off the frame",
        yaw: 35,
        pitch: 20,
        seconds: DOOR_SWING_SECONDS + (DOOR_REBOUND_SECONDS * DOOR_FIRST_BOUNCE_SHARE) / 2,
      },
      { label: "shut", yaw: 35, pitch: 20, seconds: 1 },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      onDeck(0, 0, { foundation: true });
      onDeck(0, 0.5, { edgePiece: "doorFrame", facing: { turns: 0 } });
    },
    pose(stage, shot) {
      const { store, movePlayer } = stage;
      for (const door of [...store.with("door")]) store.remove(door);
      onDeckOf(stage)(0, 0.5, { door: true, facing: { turns: 0 } });
      const near = shot.label.startsWith("swinging open") || shot.label.startsWith("open");
      if (near) movePlayer(0, shot.label.startsWith("open") ? 0.5 : -0.2, 0);
      else movePlayer(0, 2, 0);
    },
    // The player walks in a loop from inside the cabin, out through the door, and back.
    play: {
      shot: { label: "walking through the door and back", yaw: 60, pitch: 20 },
      pose({ store, movePlayer }, seconds) {
        if (store.with("door").first === undefined) {
          const frame = store.with("edgePiece", "position").first;
          if (frame !== undefined) store.add({ door: true, facing: { turns: 0 }, position: { ...frame.position } });
        }
        const t = seconds % DOOR_WALK_CYCLE_SECONDS;
        const half = DOOR_WALK_CYCLE_SECONDS / 2;
        const outward = t < half;
        const share = outward ? t / half : (t - half) / half;
        const z = outward ? DOOR_WALK_FROM_Z + (DOOR_WALK_TO_Z - DOOR_WALK_FROM_Z) * share : DOOR_WALK_TO_Z + (DOOR_WALK_FROM_Z - DOOR_WALK_TO_Z) * share;
        movePlayer(0, z, outward ? 0 : Math.PI);
        return undefined;
      },
    },
  },
  shutters: {
    radius: 1.5,
    focus: { x: 0, y: 1, z: 0.5 },
    // A window on the front edge of a foundation: a shutters blueprint with 1 of 2 planks, the 2nd leaf being set down,
    // then the finished shutters, closed, from the front with their hinges and from behind, then open. The player stands aside.
    shots: [
      { label: `blueprint, 1 of ${SHUTTERS_PLANK_COST} planks`, yaw: 25, pitch: 15, seconds: 0 },
      { label: "2nd leaf above its place", yaw: 25, pitch: 15, seconds: (1 + BUILD_FADE_SHARE) / SHUTTERS_PLANK_COST },
      { label: "built, closed, front", yaw: 0, pitch: 10, seconds: 1 },
      { label: "built, closed, back", yaw: 180, pitch: 10, seconds: 1 },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      onDeck(0, 0, { foundation: true });
      onDeck(0, 0.5, { edgePiece: "window", facing: { turns: 0 } });
      onDeck(0, 0.5, { blueprint: { structure: "shutters", progress: 0, materialsSpent: 0, delivered: { plank: 1 } }, facing: { turns: 0 } });
      stage.movePlayer(1.4, 1.6, -Math.PI / 2);
    },
    pose({ store }, shot) {
      const progress = shot.seconds ?? 0;
      for (const entity of [...store.with("blueprint"), ...store.with("shutters")]) {
        if (progress >= 1) {
          store.removeComponent(entity, "blueprint");
          setComponent(store, entity, "shutters", { open: false });
          continue;
        }
        store.removeComponent(entity, "shutters");
        setComponent(store, entity, "blueprint", { structure: "shutters", progress, materialsSpent: 0, delivered: {} });
        if (entity.blueprint !== undefined) entity.blueprint.delivered.plank = Math.max(1, Math.ceil(progress * SHUTTERS_PLANK_COST));
      }
    },
  },
  "window-glow": {
    radius: 2.2,
    focus: { x: 0, y: 1, z: 0.5 },
    // A one-square cabin with a roof, a window in its front wall, and a lit torch planted inside. The window glows warm
    // from outside at night, fainter at dusk. Closed shutters, or daylight, show no glow.
    shots: [
      { label: "night, open window", yaw: 20, pitch: 12, hour: NIGHT },
      { label: "dusk, open window", yaw: 20, pitch: 12, hour: DUSK },
      { label: "night, shutters closed", yaw: 20, pitch: 12, hour: NIGHT, seconds: 1 },
      { label: "noon, open window", yaw: 20, pitch: 12, hour: NOON },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      onDeck(0, 0, { foundation: true });
      for (const turns of [1, 2, 3] as const) {
        const out = turnOffset({ x: 0, z: 0.5 }, turns);
        onDeck(out.x, out.z, { edgePiece: "logWall", facing: { turns } });
      }
      onDeck(0, 0.5, { edgePiece: "window", facing: { turns: 0 } });
      roofOver(stage, 0, 0, 0);
      onDeck(0.2, -0.2, { plantedTorch: { minutesLeft: 60 } });
      stage.movePlayer(1.6, 1.6, -Math.PI / 2);
    },
    pose(stage, shot) {
      for (const shutters of [...stage.store.with("shutters")]) stage.store.remove(shutters);
      if (shot.label.includes("closed")) onDeckOf(stage)(0, 0.5, { shutters: { open: false }, facing: { turns: 0 } });
    },
    // The open window at night, so the firelight flickers live.
    play: {
      shot: { label: "night, flickering", yaw: 20, pitch: 12, hour: NIGHT },
      pose() {
        return undefined;
      },
    },
  },
  "shutter-swing": {
    radius: 1.6,
    focus: { x: 0, y: 1, z: 0.5 },
    // Finished shutters in a window. Each view hangs new shutters, so they start to swing as the view's clock starts:
    // swinging open with the right leaf trailing, the left leaf knocked back off the wall, open and folded back, then
    // swinging closed.
    shots: [
      { label: "swinging open, right leaf trailing", yaw: 35, pitch: 20, seconds: SHUTTER_SWING_SECONDS / 3 },
      {
        label: "opening, left leaf knocked back off the wall",
        yaw: 35,
        pitch: 20,
        seconds: SHUTTER_SWING_SECONDS + (SHUTTER_KNOCK_SECONDS * SHUTTER_FIRST_BOUNCE_SHARE) / 2,
      },
      { label: "open, folded back", yaw: 35, pitch: 20, seconds: 1.5 },
      { label: "swinging closed", yaw: 35, pitch: 20, seconds: SHUTTER_SWING_SECONDS / 2 },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      onDeck(0, 0, { foundation: true });
      onDeck(0, 0.5, { edgePiece: "window", facing: { turns: 0 } });
      stage.movePlayer(1.4, 1.6, -Math.PI / 2);
    },
    pose(stage, shot) {
      for (const shutters of [...stage.store.with("shutters")]) stage.store.remove(shutters);
      onDeckOf(stage)(0, 0.5, { shutters: { open: shot.label.includes("open") }, facing: { turns: 0 } });
    },
    // The shutters open and close in a loop, as the player opens and closes them.
    play: {
      shot: { label: "opening and closing", yaw: 35, pitch: 20 },
      pose({ store }, seconds) {
        const shutters = store.with("shutters").first;
        if (shutters === undefined) {
          const frame = store.with("edgePiece", "position").first;
          if (frame !== undefined) store.add({ shutters: { open: false }, facing: { turns: 0 }, position: { ...frame.position } });
          return undefined;
        }
        shutters.shutters.open = seconds % SHUTTER_LOOP_SECONDS < SHUTTER_LOOP_SECONDS / 2;
        return undefined;
      },
    },
  },
};

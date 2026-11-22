// Draws the "birds" (draft) in the valley: the flocks over the treetops and the birds on the ground near the player.
// bird-life.ts decides where every bird is. This file tells it about the valley and draws what it says.
// Birds are only for looks. They are never picked, so they never block walking or the action menu, and they cast no shadows.
import * as THREE from "three";
import { heldFires, rainEntities, type EntityStore } from "../sim/entities";
import { createGroundMap, groundTypeAt } from "../sim/ground-types";
import type { GroundPoint } from "../sim/ground-point";
import { distanceToRiver, terrainHeightAt, type Valley } from "../sim/valley";
import { birdMayLandAt, createBirdLife, FLOCK_SIZE, MOST_FLOCKS, MOST_GROUND_BIRDS, type DrawnBird } from "./bird-life";
import { BIRD_PARTS, birdPartMatrix, createBirdMaterial, createBirdShape, type BirdPart } from "./bird-shape";
import { campFootprints, isUnderCamp } from "./camp-footprints";

const MOST_BIRDS = MOST_FLOCKS * FLOCK_SIZE.max + MOST_GROUND_BIRDS;
/** A frame longer than this, in seconds, moves the birds only this far, so a hidden tab does not fling them about. */
const LONGEST_STEP_SECONDS = 0.1;
/**
 * Birds draw this many times their real size in the game, as the player is drawn with a large head.
 * At the game camera's distance a real 14 cm songbird is a speck.
 */
const DRAWN_SCALE = 3;

export interface BirdMeshes {
  readonly group: THREE.Group;
  /** Moves the birds on to `nowSeconds` around the player, and draws them. `daylight` runs from 0 (night) to 1 (full day). */
  update(nowSeconds: number, player: GroundPoint | undefined, daylight: number): void;
  dispose(): void;
}

export function createBirdMeshes(entities: EntityStore, valley: Valley): BirdMeshes {
  const group = new THREE.Group();
  group.name = "birds";
  const shape = createBirdShape();
  const material = createBirdMaterial();
  const partMesh = (part: BirdPart): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(shape[part], material, MOST_BIRDS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Birds move every frame, so their bounds are never up to date. There are few of them.
    mesh.frustumCulled = false;
    mesh.raycast = () => undefined;
    group.add(mesh);
    return mesh;
  };
  const parts: Record<BirdPart, THREE.InstancedMesh> = {
    body: partMesh("body"),
    head: partMesh("head"),
    leftWing: partMesh("leftWing"),
    rightWing: partMesh("rightWing"),
  };

  // New random places on every load: the birds do not follow the valley's seed.
  const life = createBirdLife(Math.random);
  const groundMap = createGroundMap(valley);
  const weather = rainEntities(entities);
  const groundHeightAt = (x: number, z: number): number => terrainHeightAt(valley.terrain, x, z);
  let lastSeconds: number | undefined;

  const place = new THREE.Matrix4();
  const partMatrix = new THREE.Matrix4();
  const spot = new THREE.Vector3();
  const facing = new THREE.Quaternion();
  const upright = new THREE.Vector3(0, 1, 0);
  const drawnScale = new THREE.Vector3(DRAWN_SCALE, DRAWN_SCALE, DRAWN_SCALE);

  function draw(birds: readonly DrawnBird[]): void {
    birds.forEach((bird, index) => {
      place.compose(spot.set(bird.x, bird.y, bird.z), facing.setFromAxisAngle(upright, bird.heading), drawnScale);
      for (const part of BIRD_PARTS) parts[part].setMatrixAt(index, partMatrix.multiplyMatrices(place, birdPartMatrix(part, bird, partMatrix)));
    });
    for (const part of BIRD_PARTS) {
      parts[part].count = birds.length;
      parts[part].instanceMatrix.needsUpdate = true;
    }
  }

  return {
    group,
    update(nowSeconds, player, daylight) {
      const seconds = lastSeconds === undefined ? 0 : Math.min(Math.max(nowSeconds - lastSeconds, 0), LONGEST_STEP_SECONDS);
      lastSeconds = nowSeconds;
      // The camp and its fires change rarely, but reading them is cheap, so each frame sees them as they are.
      const footprints = campFootprints(entities);
      const litFires = heldFires(entities)
        .filter((held) => held.fire.lit)
        .map((held) => held.entity.position);
      const ground = {
        isClearing: (at: GroundPoint) => groundTypeAt(groundMap, at) === "clearing",
        isRiver: (at: GroundPoint) => distanceToRiver(valley.river, at) <= valley.river.width / 2,
        isUnderCamp: (at: GroundPoint) => isUnderCamp(footprints, at.x, at.z),
        litFires,
      };
      life.step(seconds, {
        daylight,
        raining: weather.first?.rain.falling === true,
        player,
        canLandAt: (at) => birdMayLandAt(ground, at),
        groundHeightAt,
      });
      const visibility = life.visibility();
      group.visible = visibility > 0;
      if (!group.visible) return;
      material.opacity = visibility;
      // Fully seen birds draw solid, so they sort and shade like everything else.
      const fading = visibility < 1;
      if (material.transparent !== fading) {
        material.transparent = fading;
        material.needsUpdate = true;
      }
      draw([...life.flocks().flat(), ...life.groundBirds()].slice(0, MOST_BIRDS));
    },
    dispose() {
      for (const part of BIRD_PARTS) {
        shape[part].dispose();
        parts[part].dispose();
      }
      material.dispose();
    },
  };
}

// Builds the draft "fishing-rod" asset in asset-manifest.json: the rod in the player's hands while they fish. Built in code.
// Added by fishing ticket 02. It matches the fishing rod in the draft "fishing-piles": a thin wooden rod made of two
// sticks joined end to end, thicker at the butt, lashed with twine where they meet, with a turn of line tied at the tip.
// The line itself runs from the tip and is drawn by player-mesh.ts, because its far end moves as the player casts.
// The butt is at the group's origin and the rod points along +z.
import * as THREE from "three";

/** How long the rod is, from butt to tip, in metres. */
export const FISHING_ROD_LENGTH_METRES = 1.5;
const BUTT_RADIUS_METRES = 0.014;
const TIP_RADIUS_METRES = 0.005;
/** Where the two sticks meet, from the butt, in metres. Twine lashes them together there. */
const JOIN_FROM_BUTT_METRES = 0.7;
const LASHING_LENGTH_METRES = 0.08;
/** The grip: a few turns of twine where the right hand holds the butt, in metres from the butt. */
const GRIP_FROM_BUTT_METRES = 0.03;
const GRIP_LENGTH_METRES = 0.14;

const WOOD_COLOUR = 0x9b7350;
const TWINE_COLOUR = 0xeadbb0;
const LINE_COLOUR = 0xe8e2cc;

export interface FishingRod {
  readonly group: THREE.Group;
  /** Where the line is tied, at the tip, from the butt. */
  readonly tip: THREE.Vector3;
  /** The parts, for the asset showcase, which lays them out on their own. */
  readonly parts: readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[];
  dispose(): void;
}

/** The radius of the rod at `along` metres from the butt. */
function radiusAt(along: number): number {
  return BUTT_RADIUS_METRES + (TIP_RADIUS_METRES - BUTT_RADIUS_METRES) * (along / FISHING_ROD_LENGTH_METRES);
}

/** A length of rod, or of twine wound a little proud of the rod, from `from` to `to` metres along it. */
function along(from: number, to: number, proud = 0): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radiusAt(to) + proud, radiusAt(from) + proud, to - from, 7).translate(0, (from + to) / 2, 0).rotateX(Math.PI / 2);
}

export function createFishingRod(): FishingRod {
  const wood = new THREE.MeshStandardMaterial({ color: WOOD_COLOUR, roughness: 1, flatShading: true });
  const twine = new THREE.MeshStandardMaterial({ color: TWINE_COLOUR, roughness: 1 });
  const line = new THREE.MeshStandardMaterial({ color: LINE_COLOUR, roughness: 0.8 });
  const parts = [
    { geometry: along(0, FISHING_ROD_LENGTH_METRES), material: wood },
    { geometry: along(JOIN_FROM_BUTT_METRES - LASHING_LENGTH_METRES / 2, JOIN_FROM_BUTT_METRES + LASHING_LENGTH_METRES / 2, 0.003), material: twine },
    { geometry: along(GRIP_FROM_BUTT_METRES, GRIP_FROM_BUTT_METRES + GRIP_LENGTH_METRES, 0.002), material: twine },
    // The knot of line tied round the tip.
    { geometry: along(FISHING_ROD_LENGTH_METRES - 0.03, FISHING_ROD_LENGTH_METRES - 0.005, 0.002), material: line },
  ];
  const group = new THREE.Group();
  for (const { geometry, material } of parts) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return {
    group,
    tip: new THREE.Vector3(0, 0, FISHING_ROD_LENGTH_METRES),
    parts,
    dispose() {
      for (const { geometry } of parts) geometry.dispose();
      wood.dispose();
      twine.dispose();
      line.dispose();
    },
  };
}

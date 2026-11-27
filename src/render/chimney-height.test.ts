import { describe, expect, it } from "bun:test";
import { createEntityStore } from "../sim/entities";
import { CHIMNEY_CLEARANCE_METRES, chimneyMiddleAt, chimneyTopAt, chimneyTopMetres } from "./chimney-height";
import { createChimneyStageShapes, CHIMNEY_COURSES } from "./chimney-shape";
import { ALONE, roofPlaces, type RoofPlace } from "./roof-layout";
import { COVER_THICKNESS_METRES, FRAME_TOP_METRES, frameLayout, RAFTER_RADIUS_METRES, SECTION_RISE_METRES } from "./roof-parts";
import { CHIMNEY_STONE_COST } from "../sim/structure-cabin-fittings";

/** The top of the roof's planks at its low edge, above the deck. */
const ROOF_FOOT = FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + COVER_THICKNESS_METRES;

describe("how tall a chimney is", () => {
  it("stands 0.8 m above the roof surface at its middle", () => {
    const middle = { x: 0.5, z: 0.5 };
    // A lone section sloping down to +z: its surface rises toward -z, half a rise above its low edge at the middle.
    const atMiddle = chimneyTopMetres({ place: ALONE, middle }, middle);
    expect(atMiddle).toBeCloseTo(ROOF_FOOT + 0.5 * SECTION_RISE_METRES + CHIMNEY_CLEARANCE_METRES, 5);
    // Further back, where the roof is higher, the chimney is taller.
    expect(chimneyTopMetres({ place: ALONE, middle }, { x: 0.5, z: 0.3 })).toBeGreaterThan(atMiddle);
  });

  it("is taller under a roof section that sits higher", () => {
    const middle = { x: 0.5, z: 0.5 };
    const low: RoofPlace = { ...ALONE, inFront: 0 };
    const high: RoofPlace = { ...ALONE, inFront: 2 };

    const difference = chimneyTopMetres({ place: high, middle }, middle) - chimneyTopMetres({ place: low, middle }, middle);

    expect(difference).toBeCloseTo(2 * SECTION_RISE_METRES, 5);
  });

  it("with no roof section over it, stands as under a roof one rise high", () => {
    expect(chimneyTopMetres(undefined, { x: 0, z: 0 })).toBeCloseTo(ROOF_FOOT + SECTION_RISE_METRES + CHIMNEY_CLEARANCE_METRES, 5);
  });

  it("follows the roof sections over its square in the world, finished or as a blueprint", () => {
    const store = createEntityStore();
    const square = { x: 0.5, y: 0, z: 0.5 };
    const front = { x: 0.5, y: 0, z: 1.5 };
    const roofOn = (at: typeof square) => ({ min: { x: at.x - 0.5, z: at.z - 0.5 }, max: { x: at.x + 0.5, z: at.z + 0.5 } });
    expect(chimneyTopAt(store, frameLayout(store), square, 0)).toBeCloseTo(chimneyTopMetres(undefined, chimneyMiddleAt(square, 0)), 5);

    // Two sections in a row sloping down to +z: the one over the chimney has one section in front of it, so it sits a rise higher.
    store.add({ roofFrame: true, facing: { turns: 0 }, position: { ...square } });
    store.add({ roofFrame: true, facing: { turns: 0 }, position: { ...front } });
    store.add({ blueprint: { structure: "roof", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 }, position: { ...square } });
    const place = roofPlaces([
      { position: square, turns: 0 },
      { position: front, turns: 0 },
    ]);
    const [over] = place.values();
    expect(over?.inFront).toBe(1);
    const expected = chimneyTopMetres({ place: over ?? ALONE, middle: square }, chimneyMiddleAt(square, 0));
    expect(chimneyTopAt(store, frameLayout(store), square, 0)).toBeCloseTo(expected, 5);

    store.add({ cabinRoof: true, roof: roofOn(front), facing: { turns: 0 }, position: { ...front } });
    expect(chimneyTopAt(store, frameLayout(store), front, 0)).toBeCloseTo(chimneyTopMetres({ place: ALONE, middle: front }, chimneyMiddleAt(front, 0)), 5);
  });
});

describe("a chimney's stones", () => {
  it("are built in one stage per stone it costs, reaching up to its top", () => {
    const top = 4.2;
    const stages = createChimneyStageShapes(top);
    expect(stages).toHaveLength(CHIMNEY_STONE_COST);
    expect(CHIMNEY_COURSES + 1).toBe(CHIMNEY_STONE_COST);
    const highest = Math.max(
      ...stages.map(({ geometry, middle }) => {
        geometry.computeBoundingBox();
        return (geometry.boundingBox?.max.y ?? 0) + middle[1];
      }),
    );
    expect(highest).toBeCloseTo(top, 1);
  });
});

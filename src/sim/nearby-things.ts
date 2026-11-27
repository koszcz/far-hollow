import type { BedrollView, CampfireView, NearbyThing, NearbyViews, PileView } from "./api";
import type { createBedrolls } from "./bedrolls";
import type { createBuilding } from "./building";
import type { createCampfires } from "./campfires";
import type { createChests } from "./chests";
import type { createDryingRacks } from "./drying-racks";
import type { EntityStore } from "./entities";
import type { createPiles } from "./piles";
import type { createRainBarrels } from "./rain-barrels";
import type { createWoodBoxes } from "./wood-boxes";
import type { createWoodpiles } from "./woodpiles";

/** The systems that know which of their things are within the player's reach. */
export interface NearbySources {
  entities: EntityStore;
  campfires: ReturnType<typeof createCampfires>;
  woodpiles: ReturnType<typeof createWoodpiles>;
  bedrolls: ReturnType<typeof createBedrolls>;
  piles: ReturnType<typeof createPiles>;
  building: ReturnType<typeof createBuilding>;
  chests: ReturnType<typeof createChests>;
  rainBarrels: ReturnType<typeof createRainBarrels>;
  dryingRacks: ReturnType<typeof createDryingRacks>;
  woodBoxes: ReturnType<typeof createWoodBoxes>;
}

/** Each thing within the player's reach that the HUD shows a panel for, in the order the HUD shows them. */
export function nearbyThings(sources: NearbySources): readonly NearbyThing[] {
  const { campfires, woodpiles, building, chests, rainBarrels, dryingRacks, woodBoxes } = sources;
  const things: NearbyThing[] = [];
  const add = <Kind extends NearbyThing["kind"]>(kind: Kind, view: NearbyViews[Kind] | null | undefined): void => {
    if (view !== null && view !== undefined) things.push(Object.freeze({ kind, view }) as NearbyThing);
  };
  add("campfire", nearbyCampfire(campfires));
  add("woodpile", woodpiles.nearby());
  add("bedroll", nearbyBedroll(sources));
  add("pile", nearbyPile(sources));
  add("blueprint", building.nearby());
  add("openChest", chests.opened());
  add("rainBarrel", rainBarrels.nearby());
  add("dryingRack", dryingRacks.nearby());
  add("woodBox", woodBoxes.nearby());
  return Object.freeze(things);
}

function nearbyCampfire(campfires: NearbySources["campfires"]): CampfireView | null {
  const id = campfires.nearbyFire();
  return id === undefined ? null : (campfires.describe(id) ?? null);
}

function nearbyBedroll({ bedrolls, entities }: NearbySources): BedrollView | null {
  const bedroll = bedrolls.nearby();
  const id = bedroll === undefined ? undefined : entities.id(bedroll);
  return id === undefined ? null : Object.freeze({ id });
}

function nearbyPile({ piles, entities }: NearbySources): PileView | null {
  const pile = piles.nearby();
  const id = pile === undefined ? undefined : entities.id(pile);
  if (pile === undefined || id === undefined) return null;
  return Object.freeze({ id, content: pile.pile.content, count: pile.pile.count });
}

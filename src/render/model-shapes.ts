// Loads every model shape the game draws from a file, all at once, into one object.
// The game and the asset showcase both pass this object on, so adding a model is one edit here.
import { loadBerryBushShape, type BerryBushShape } from "./berry-bush-model";
import { loadLogShape, type LogShape } from "./log-shape";
import { loadMushroomsShape, type MushroomsShape } from "./mushrooms-model";
import { loadPlayerModel, type PlayerModel } from "./player-model";
import { loadStumpShape, type StumpShape } from "./stump-model";
import { loadTreeShapes, type TreeShape } from "./tree-model";
import { loadUndergrowthShapes, type UndergrowthShape } from "./undergrowth-models";

/** Every loaded model shape. */
export interface ModelShapes {
  /** The tree types, from loadTreeShapes. */
  readonly trees: readonly TreeShape[];
  /** The stump, from loadStumpShape. */
  readonly stump: StumpShape;
  /** The log, from loadLogShape. */
  readonly log: LogShape;
  /** The berry bush, from loadBerryBushShape. */
  readonly berryBush: BerryBushShape;
  /** The mushroom patch, from loadMushroomsShape. */
  readonly mushrooms: MushroomsShape;
  /** The undergrowth models, from loadUndergrowthShapes. */
  readonly undergrowth: readonly UndergrowthShape[];
  /** The player and its animation clips, from loadPlayerModel. */
  readonly player: PlayerModel;
}

/** Loads every model shape at the same time. */
export async function loadModelShapes(): Promise<ModelShapes> {
  const [trees, stump, log, berryBush, mushrooms, undergrowth, player] = await Promise.all([
    loadTreeShapes(),
    loadStumpShape(),
    loadLogShape(),
    loadBerryBushShape(),
    loadMushroomsShape(),
    loadUndergrowthShapes(),
    loadPlayerModel(),
  ]);
  return { trees, stump, log, berryBush, mushrooms, undergrowth, player };
}

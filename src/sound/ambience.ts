// The ambience: the river, the forest, lit fires, rain, birds, and crickets. It reads the valley, the fires, the rain, and
// the daylight as game logic and drawing leave them, and says which sounds want to play and how loud. It never changes game state.
// A room changes only the rain. The river, the forest, birds, and crickets sound the same indoors.
import { blendGroundPoints, groundDistance, type GroundPoint } from "../sim/ground-point";
import { clampShare } from "../sim/share";
import { nearestRiverPoint, type River } from "../sim/valley";
import { distanceFade, panToward, type Listener } from "./listener";
import { dayNightMix } from "./day-night";
import { rainLoudness, type RainHearing } from "./rain-hearing";
import { soundKeys, type SoundWish } from "./sound-mix";

/** How loud the river is at the water's edge, before the Volume. */
const RIVER_LOUDNESS = 0.7;
/** How loud the forest rustles in a calm and in a gale, before the Volume. It follows the wind in between. */
const FOREST_LOUDNESS = { calm: 0.08, gale: 0.55 };
/** How loud a full-size fire crackles beside the player, before the Volume. A smaller flame crackles more quietly. */
const FIRE_LOUDNESS = 0.8;

/** A campfire or fireplace, given by its entity id, where it stands, and how big its flames are, from 0 (out) to 1. */
export interface FireSound {
  readonly id: number;
  readonly spot: GroundPoint;
  readonly flameSize: number;
}

/**
 * What the ambience hears from: the river, how hard the wind blows (0 calm to 1 a gale), every campfire and fireplace,
 * the rain as the player hears it, and the heard daylight, from 0 (night) to 1 (full day).
 */
export interface AmbienceScene {
  readonly river: River;
  readonly wind: number;
  readonly fires: Iterable<FireSound>;
  readonly rain: RainHearing;
  readonly daylight: number;
}

/** The river, the forest, each lit fire, the rain, the birds, and the crickets, as the listener hears them now. */
export function ambienceWishes(listener: Listener, scene: AmbienceScene): SoundWish[] {
  const water = nearestWater(scene.river, listener.spot);
  const rain = rainLoudness(scene.rain);
  const dayNight = dayNightMix(scene.daylight);
  const wishes: SoundWish[] = [
    { key: "river", sound: "sound-river", loudness: RIVER_LOUDNESS * distanceFade(listener, water), pan: panToward(listener, water) },
    { key: "forest", sound: "sound-forest", loudness: forestLoudness(scene.wind), pan: 0 },
    { key: "rain", sound: "sound-rain", loudness: rain.open, pan: 0 },
    { key: "rain-roof", sound: "sound-rain-roof", loudness: rain.roof, pan: 0 },
    { key: "birds", sound: "sound-birds", loudness: dayNight.birds, pan: 0 },
    { key: "crickets", sound: "sound-crickets", loudness: dayNight.crickets, pan: 0 },
  ];
  for (const fire of scene.fires) {
    if (fire.flameSize <= 0) continue;
    wishes.push({
      key: soundKeys.fire(fire.id),
      sound: "sound-fire",
      loudness: FIRE_LOUDNESS * fire.flameSize * distanceFade(listener, fire.spot),
      pan: panToward(listener, fire.spot),
    });
  }
  return wishes;
}

/** How loud the forest rustles in a wind of this strength, from 0 (calm) to 1 (a gale). */
function forestLoudness(wind: number): number {
  return FOREST_LOUDNESS.calm + (FOREST_LOUDNESS.gale - FOREST_LOUDNESS.calm) * clampShare(wind);
}

/** The bit of water nearest `spot`: the spot itself in the water, or else the nearest point on the river's edge. */
function nearestWater(river: River, spot: GroundPoint): GroundPoint {
  const middle = nearestRiverPoint(river, spot);
  const fromMiddle = groundDistance(middle, spot);
  const halfWidth = river.width / 2;
  return fromMiddle <= halfWidth ? spot : blendGroundPoints(middle, spot, halfWidth / fromMiddle);
}

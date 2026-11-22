// The sound layer of a running game. Each frame it reads the game state, as the drawing does, works out the ambience the
// player hears, and hands it to the sound engine. It never changes game state (ADR 0001).
import { campfireEntities, fireplaceEntities, playerEntities, rainEntities, type EntityStore } from "../sim/entities";
import type { GroundPoint } from "../sim/ground-point";
import { isUnderRoof } from "../sim/roofs";
import type { Valley } from "../sim/valley";
import { daylightAt } from "../render/daylight";
import { flameSize } from "../render/flame-size";
import { windStrength } from "../render/wind";
import { ambienceWishes, type FireSound } from "./ambience";
import { easeHeardDaylight } from "./day-night";
import { listenerFrom } from "./listener";
import { easeRainHearing, rainHearingNow, type RainHearing } from "./rain-hearing";
import type { SoundEngine } from "./sound-engine";

/** What the player hears now, as drawing shows it. */
export interface SoundFrame {
  /** Where the camera is and where it looks. */
  readonly camera: { readonly eye: GroundPoint; readonly focus: GroundPoint };
  /** The hour of the day the sky shows, with its fraction. Birds and crickets follow its daylight. */
  readonly hourOfDay: number;
  /** Silences all sound, from 0 to 1, such as while the sleep animation fades to black. */
  readonly silence: number;
}

export interface ValleySound {
  /** Plays what the player hears at `nowSeconds`. */
  update(nowSeconds: number, frame: SoundFrame): void;
}

export function createValleySound(engine: SoundEngine, valley: Valley, entities: EntityStore): ValleySound {
  const players = playerEntities(entities);
  const weather = rainEntities(entities);
  const campfires = campfireEntities(entities);
  const fireplaces = fireplaceEntities(entities);
  /** The rain as the player hears it, and the heard daylight. Undefined until the first frame. */
  let rain: RainHearing | undefined;
  let daylight: number | undefined;
  let lastSeconds: number | undefined;

  function* fires(): Generator<FireSound> {
    for (const entity of campfires) yield { id: entities.id(entity) ?? -1, spot: entity.position, flameSize: flameSize("campfire", entity.campfire) };
    for (const entity of fireplaces) yield { id: entities.id(entity) ?? -1, spot: entity.position, flameSize: flameSize("fireplace", entity.fireplace) };
  }

  return {
    update(nowSeconds, { camera, hourOfDay, silence }) {
      const began = performance.now();
      const raining = weather.first?.rain.falling === true;
      const player = players.first?.position ?? camera.focus;
      // The same rule as the player's shelter from rain.
      const underRoof = isUnderRoof(entities, player);
      const elapsed = nowSeconds - (lastSeconds ?? nowSeconds);
      // The first frame takes the weather and the time of day as they are, so a loaded game does not fade them in.
      rain = rain === undefined ? rainHearingNow(raining, underRoof) : easeRainHearing(rain, raining, underRoof, elapsed);
      daylight = daylight === undefined ? daylightAt(hourOfDay) : easeHeardDaylight(daylight, daylightAt(hourOfDay), elapsed);
      lastSeconds = nowSeconds;
      const listener = listenerFrom(player, camera);
      const wishes = ambienceWishes(listener, {
        river: valley.river,
        wind: windStrength(nowSeconds, rain.falling),
        fires: fires(),
        rain,
        daylight,
      });
      engine.play(wishes, silence);
      engine.recordFrameMs(performance.now() - began);
    },
  };
}

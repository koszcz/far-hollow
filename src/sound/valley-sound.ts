// The sound layer of a running game. Each frame it reads the game state and the drawn player, as the drawing does, works
// out the ambience and action sounds the player hears, and hands them to the sound engine. It never changes game state (ADR 0001).
import { campfireEntities, fireplaceEntities, playerEntities, rainEntities, type EntityStore } from "../sim/entities";
import type { GroundPoint } from "../sim/ground-point";
import type { Valley } from "../sim/valley";
import { flameSize } from "../render/flame-size";
import { easeRainShare, windStrength } from "../render/wind";
import type { DrawnPlayer } from "../render/scene-renderer";
import { createActionSounds } from "./action-sounds";
import { ambienceWishes, type FireSound } from "./ambience";
import { listenerFrom } from "./listener";
import { createPlaceClicks } from "./place-clicks";
import type { SoundEngine } from "./sound-engine";

export interface ValleySound {
  /**
   * Plays what the player hears now. `camera` is where the camera is and where it looks. `silence` runs from 0 to 1, and
   * silences all sound, such as while the sleep animation fades to black. `player` is what the drawn player did this
   * frame, and `asleep` whether the sleep animation plays.
   */
  update(
    nowSeconds: number,
    camera: { readonly eye: GroundPoint; readonly focus: GroundPoint },
    silence: number,
    player: { readonly drawn: DrawnPlayer; readonly asleep: boolean },
  ): void;
}

export function createValleySound(engine: SoundEngine, valley: Valley, entities: EntityStore): ValleySound {
  const players = playerEntities(entities);
  const weather = rainEntities(entities);
  const campfires = campfireEntities(entities);
  const fireplaces = fireplaceEntities(entities);
  const actionSounds = createActionSounds();
  const placeClicks = createPlaceClicks(entities);
  /** How far rain has eased in, from 0 (dry) to 1, for the wind. Undefined until the first frame. */
  let rainShare: number | undefined;
  let lastSeconds: number | undefined;

  function* fires(): Generator<FireSound> {
    for (const entity of campfires) yield { id: entities.id(entity) ?? -1, spot: entity.position, flameSize: flameSize("campfire", entity.campfire) };
    for (const entity of fireplaces) yield { id: entities.id(entity) ?? -1, spot: entity.position, flameSize: flameSize("fireplace", entity.fireplace) };
  }

  return {
    update(nowSeconds, camera, silence, player) {
      const began = performance.now();
      const raining = weather.first?.rain.falling === true;
      // The first frame takes the weather as it is, so a game loaded in the rain does not ease in.
      rainShare = rainShare === undefined ? (raining ? 1 : 0) : easeRainShare(rainShare, raining, nowSeconds - (lastSeconds ?? nowSeconds));
      lastSeconds = nowSeconds;
      const spot = players.first?.position ?? camera.focus;
      const listener = listenerFrom(spot, camera);
      const wishes = ambienceWishes(listener, { river: valley.river, wind: windStrength(nowSeconds, rainShare), fires: fires() });
      const { work, walkedMetres } = player.drawn;
      const doing = {
        spot,
        clicks: placeClicks.clicksSinceLastFrame(),
        asleep: player.asleep,
        ...(work === undefined ? {} : { work }),
        ...(walkedMetres === undefined ? {} : { walkedMetres }),
      };
      // Action sounds keep time on the performance clock, as the drawn motions do.
      wishes.push(...actionSounds.wishes(listener, doing, performance.now() / 1000));
      engine.play(wishes, silence);
      engine.recordFrameMs(performance.now() - began);
    },
  };
}

// Developer tools: the frame rate, the clock, the season, the rain, and the rooms the game has found. Off by default. The backquote key (`) shows and hides it.
import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { GameClient } from "../sim/api-client";
import type { GameView } from "../sim/api-game-view";
import { debugText } from "../strings/debug";
import { timeText } from "../strings/time";

/** The key left of 1 on a US keyboard, or the backquote character on any layout. */
const TOGGLE_KEY_CODE = "Backquote";
const TOGGLE_KEY = "`";
/** How often the frame rate shown is refreshed. */
const FPS_SAMPLE_MS = 500;
/** The skip buttons, in game hours. */
const SKIP_HOURS = [1, 6] as const;

export function DebugOverlay({ client }: { client: GameClient }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat) return;
      if (event.code !== TOGGLE_KEY_CODE && event.key !== TOGGLE_KEY) return;
      setOpen((wasOpen) => !wasOpen);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return open ? <DebugPanel client={client} /> : null;
}

function DebugPanel({ client }: { client: GameClient }) {
  const view = useGameView(client);
  const fps = useFramesPerSecond();
  // Rooms are worked out afresh each time, so they follow every piece finished or taken down.
  const rooms = client.describeRooms();

  return (
    <div class="debug-overlay">
      <dl>
        <dt>{debugText.debugFps}</dt>
        <dd>{fps === undefined ? "–" : Math.round(fps)}</dd>
        <dt>{debugText.debugEntities}</dt>
        <dd>{view.entityCount}</dd>
        <dt>{debugText.debugSeed}</dt>
        <dd>{view.seed}</dd>
        <dt>{debugText.debugTime}</dt>
        <dd>{formatTime(view.time)}</dd>
        <dt>{debugText.debugSeason}</dt>
        <dd>{debugText.debugSeasonDay(timeText.seasons[view.season.season], view.season.dayOfSeason, view.season.seasonDays)}</dd>
        <dt>{debugText.debugRain}</dt>
        <dd>{view.snowing ? debugText.debugRainSnowing : view.raining ? debugText.debugRainFalling : debugText.debugRainDry}</dd>
        <dt>{debugText.debugRooms}</dt>
        <dd>{rooms.length}</dd>
        {rooms.map((room, index) => (
          <Fragment key={index}>
            <dt>{index + 1}</dt>
            <dd>{debugText.debugRoom(room.squares.length, room.heated, room.snug)}</dd>
          </Fragment>
        ))}
      </dl>
      {SKIP_HOURS.map((hours) => (
        <button
          key={hours}
          type="button"
          onClick={() => {
            client.send({ type: "skipTime", hours });
          }}
        >
          {debugText.debugSkipHours(hours)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          client.send({ type: "skipToRainChange" });
        }}
      >
        {debugText.debugSkipToRainChange(view.raining || view.snowing)}
      </button>
      <button
        type="button"
        onClick={() => {
          client.send({ type: "skipToSeason" });
        }}
      >
        {debugText.debugSkipToSeason}
      </button>
    </div>
  );
}

function formatTime(time: GameView["time"]): string {
  const hh = String(time.hour).padStart(2, "0");
  const mm = String(time.minute).padStart(2, "0");
  return debugText.debugDayAndTime(time.day, `${hh}:${mm}`);
}

function useGameView(client: GameClient): GameView {
  const [view, setView] = useState(client.getView());
  useEffect(
    () =>
      client.subscribe(() => {
        setView(client.getView());
      }),
    [client],
  );
  return view;
}

/** Counts animation frames the browser draws, so the overlay shows the real frame rate. */
function useFramesPerSecond(): number | undefined {
  const [fps, setFps] = useState<number>();
  useEffect(() => {
    let frames = 0;
    let sampleStartMs = performance.now();
    let request = requestAnimationFrame(countFrame);
    function countFrame(nowMs: number): void {
      frames += 1;
      const elapsedMs = nowMs - sampleStartMs;
      if (elapsedMs >= FPS_SAMPLE_MS) {
        setFps((frames * 1000) / elapsedMs);
        frames = 0;
        sampleStartMs = nowMs;
      }
      request = requestAnimationFrame(countFrame);
    }
    return () => {
      cancelAnimationFrame(request);
    };
  }, []);
  return fps;
}

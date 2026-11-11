// Developer tools. Off by default. The backquote key (`) shows and hides it.
import { useEffect, useState } from "preact/hooks";
import type { GameClient, GameView } from "../sim/api";
import { strings } from "../strings";

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

  return (
    <div class="debug-overlay">
      <dl>
        <dt>{strings.debugFps}</dt>
        <dd>{fps === undefined ? "–" : Math.round(fps)}</dd>
        <dt>{strings.debugEntities}</dt>
        <dd>{view.entityCount}</dd>
        <dt>{strings.debugSeed}</dt>
        <dd>{view.seed}</dd>
        <dt>{strings.debugTime}</dt>
        <dd>{formatTime(view.time)}</dd>
        <dt>{strings.debugRain}</dt>
        <dd>{view.raining ? strings.debugRainFalling : strings.debugRainDry}</dd>
      </dl>
      {SKIP_HOURS.map((hours) => (
        <button
          key={hours}
          type="button"
          onClick={() => {
            client.send({ type: "skipTime", hours });
          }}
        >
          {strings.debugSkipHours(hours)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          client.send({ type: "skipToRainChange" });
        }}
      >
        {strings.debugSkipToRainChange(view.raining)}
      </button>
    </div>
  );
}

function formatTime(time: GameView["time"]): string {
  const hh = String(time.hour).padStart(2, "0");
  const mm = String(time.minute).padStart(2, "0");
  return strings.debugDayAndTime(time.day, `${hh}:${mm}`);
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

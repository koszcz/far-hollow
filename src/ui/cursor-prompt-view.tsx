// Draws the cursor prompt beside the cursor. src/app/cursor-prompt.ts decides its words, and
// src/app/cursor-prompt-overlay.tsx renders this component again only when the words change.
// Following the cursor costs one style change per pointer move: it writes the transform straight to the element.
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";

/** One line of the prompt: a mouse button and what it does. */
export interface PromptLine {
  /** The button's name, such as "Left-click". */
  readonly button: string;
  /** The key that does the same, such as "E", if one does. */
  readonly key?: string;
  /** What the button does, such as "Chop", or "Chop: needs the axe" when the player cannot do it yet. */
  readonly text: string;
  /** False when the player cannot do it yet. The prompt greys the line. */
  readonly enabled: boolean;
}

export interface CursorPrompt {
  /** The thing's name, such as "Tree". */
  readonly title: string;
  readonly lines: readonly PromptLine[];
}

/** The HUD buttons that show a prompt without being a thing the player acts on. */
export type PromptButton = "build" | "craft";

/** How far the prompt sits from the cursor's tip, in page pixels. */
const OFFSET_PIXELS = 16;

/** The prompt beside the cursor, or nothing when `prompt` is undefined. */
export function CursorPromptView({ prompt }: { prompt: CursorPrompt | undefined }) {
  const box = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: 0, y: 0 });
  /** The prompt's size, read once each time its words change, so a pointer move never measures it. */
  const size = useRef({ width: 0, height: 0 });

  /** Puts the prompt below and right of the cursor, or on the other side where it would leave the window. */
  function place(): void {
    const element = box.current;
    if (element === null) return;
    const { x: cursorX, y: cursorY } = cursor.current;
    const { width, height } = size.current;
    const right = cursorX + OFFSET_PIXELS + width > window.innerWidth;
    const below = cursorY + OFFSET_PIXELS + height <= window.innerHeight;
    const x = right ? cursorX - OFFSET_PIXELS - width : cursorX + OFFSET_PIXELS;
    const y = below ? cursorY + OFFSET_PIXELS : cursorY - OFFSET_PIXELS - height;
    element.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent): void {
      cursor.current = { x: event.clientX, y: event.clientY };
      place();
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    size.current = { width: element.offsetWidth, height: element.offsetHeight };
    place();
  }, [prompt]);

  if (prompt === undefined) return null;
  return (
    // Screen readers already hear each HUD button's name, and the scene has no reader support.
    <div ref={box} class="cursor-prompt" aria-hidden="true">
      <strong>{prompt.title}</strong>
      {prompt.lines.map(({ button, key, text, enabled }) => (
        <span key={button} class={enabled ? "cursor-prompt-line" : "cursor-prompt-line cursor-prompt-off"}>
          <kbd class="hud-key">{button}</kbd>
          {key !== undefined && <kbd class="hud-key">{key}</kbd>}
          {text}
        </span>
      ))}
    </div>
  );
}

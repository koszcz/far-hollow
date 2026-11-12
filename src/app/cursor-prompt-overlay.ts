// Draws the cursor prompt beside the cursor. src/app/cursor-prompt.ts decides its words.
// It is plain DOM, not Preact, so following the cursor costs one style change per pointer move.
// The scene reports what the cursor is over through setSceneTarget. HUD elements mark themselves with
// data-prompt-item (a backpack content, or "shoulder" for the carried log) or data-prompt-button ("build" or "craft"), and the overlay finds them itself.
import type { ScenePick } from "../render/scene-renderer";
import type { BackpackContent, GameClient } from "../sim/api";
import { strings } from "../strings";
import { promptFor, promptForButton, type CursorPrompt, type PromptButton } from "./cursor-prompt";

/** How far the prompt sits from the cursor's tip, in page pixels. */
const OFFSET_PIXELS = 16;

export interface CursorPromptOverlay {
  /** What the cursor is over in the scene, or undefined over nothing or while placing a blueprint. */
  setSceneTarget(pick: ScenePick | undefined): void;
  /** Hides the prompt while something else shows at the cursor, such as the right-click menu. */
  setHidden(hidden: boolean): void;
  dispose(): void;
}

export function attachCursorPrompt(client: GameClient): CursorPromptOverlay {
  const element = document.createElement("div");
  element.className = "cursor-prompt";
  // Screen readers already hear each HUD button's name, and the scene has no reader support.
  element.setAttribute("aria-hidden", "true");
  element.hidden = true;
  document.body.append(element);

  let sceneTarget: ScenePick | undefined;
  /** The HUD element under the cursor that asks for a prompt, if any. */
  let hudElement: HTMLElement | null = null;
  let hidden = false;
  let cursor = { x: 0, y: 0 };
  /** The prompt now drawn, as text, so it is redrawn only when it changes. */
  let drawn = "";
  let size = { width: 0, height: 0 };

  function currentPrompt(): CursorPrompt | undefined {
    if (hidden) return undefined;
    if (hudElement !== null) {
      if (!hudElement.isConnected) hudElement = null;
      else return hudPrompt(hudElement);
    }
    return sceneTarget === undefined ? undefined : promptFor({ kind: "scene", pick: sceneTarget }, client);
  }

  function hudPrompt(source: HTMLElement): CursorPrompt | undefined {
    const item = source.dataset.promptItem;
    if (item === "shoulder") {
      const log = client.getView().carrying;
      return log === null ? undefined : promptFor({ kind: "shoulder", log }, client);
    }
    if (item !== undefined && item in strings.backpackContents) return promptFor({ kind: "item", content: item as BackpackContent }, client);
    const button = source.dataset.promptButton;
    if (button === "build" || button === "craft") return promptForButton(button satisfies PromptButton, source.getAttribute("aria-pressed") === "true");
    return undefined;
  }

  function refresh(): void {
    const prompt = currentPrompt();
    const text = prompt === undefined ? "" : JSON.stringify(prompt);
    if (text === drawn) return;
    drawn = text;
    element.hidden = prompt === undefined;
    if (prompt === undefined) return;
    draw(prompt);
    size = { width: element.offsetWidth, height: element.offsetHeight };
    place();
  }

  function draw(prompt: CursorPrompt): void {
    const title = document.createElement("strong");
    title.textContent = prompt.title;
    const lines = prompt.lines.map(({ button, text, enabled }) => {
      const line = document.createElement("span");
      line.className = enabled ? "cursor-prompt-line" : "cursor-prompt-line cursor-prompt-off";
      const key = document.createElement("kbd");
      key.className = "hud-key";
      key.textContent = button;
      line.append(key, text);
      return line;
    });
    element.replaceChildren(title, ...lines);
  }

  /** Puts the prompt below and right of the cursor, or on the other side where it would leave the window. */
  function place(): void {
    if (element.hidden) return;
    const right = cursor.x + OFFSET_PIXELS + size.width > window.innerWidth;
    const below = cursor.y + OFFSET_PIXELS + size.height <= window.innerHeight;
    const x = right ? cursor.x - OFFSET_PIXELS - size.width : cursor.x + OFFSET_PIXELS;
    const y = below ? cursor.y + OFFSET_PIXELS : cursor.y - OFFSET_PIXELS - size.height;
    element.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
  }

  function onPointerMove(event: PointerEvent): void {
    cursor = { x: event.clientX, y: event.clientY };
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-prompt-item], [data-prompt-button]") : null;
    if (target !== hudElement) {
      hudElement = target;
      refresh();
    }
    place();
  }

  function onPointerLeave(): void {
    hudElement = null;
    sceneTarget = undefined;
    refresh();
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  const unsubscribe = client.subscribe(refresh);
  return {
    setSceneTarget(pick) {
      sceneTarget = pick;
      refresh();
    },
    setHidden(value) {
      hidden = value;
      refresh();
    },
    dispose() {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      unsubscribe();
      element.remove();
    },
  };
}

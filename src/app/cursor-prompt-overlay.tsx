// Shows the cursor prompt for what the cursor is over. src/app/cursor-prompt.ts decides its words, and
// src/ui/cursor-prompt-view.tsx draws them beside the cursor. The view renders again only when the words change.
// The scene reports what the cursor is over through setSceneTarget. HUD elements mark themselves, and the overlay finds them itself:
// data-prompt-content names a backpack content, data-prompt-chest-content names a content of the open chest, data-prompt-shoulder marks the carried log, data-prompt-sled marks the dragged sled,
// and data-prompt-button names "build" or "craft".
import { render } from "preact";
import type { ScenePick } from "../render/scene-renderer";
import type { BackpackContent, GameClient } from "../sim/api";
import { strings } from "../strings";
import { CursorPromptView } from "../ui/cursor-prompt-view";
import { promptFor, promptForButton, promptForChestContent, type CursorPrompt, type PromptButton } from "./cursor-prompt";

export interface CursorPromptOverlay {
  /** What the cursor is over in the scene, or undefined over nothing or while placing a blueprint. */
  setSceneTarget(pick: ScenePick | undefined): void;
  /** Hides the prompt while something else shows at the cursor, such as the action menu. */
  setHidden(hidden: boolean): void;
  dispose(): void;
}

/** The HUD elements that ask for a prompt. */
const PROMPT_SELECTOR = "[data-prompt-content], [data-prompt-chest-content], [data-prompt-shoulder], [data-prompt-sled], [data-prompt-button]";

export function attachCursorPrompt(client: GameClient): CursorPromptOverlay {
  const container = document.createElement("div");
  document.body.append(container);

  let sceneTarget: ScenePick | undefined;
  /** The HUD element under the cursor that asks for a prompt, if any. */
  let hudElement: HTMLElement | null = null;
  let hidden = false;
  /** The prompt now drawn, as text, so it is drawn again only when it changes. Null before the first draw. */
  let drawn: string | null = null;

  function currentPrompt(): CursorPrompt | undefined {
    if (hidden) return undefined;
    if (hudElement !== null) {
      if (!hudElement.isConnected) hudElement = null;
      else return hudPrompt(hudElement);
    }
    return sceneTarget === undefined ? undefined : promptFor({ kind: "scene", pick: sceneTarget }, client, client.nearestInReach());
  }

  function hudPrompt(source: HTMLElement): CursorPrompt | undefined {
    if (source.dataset.promptShoulder !== undefined) {
      const log = client.getView().carrying;
      return log === null ? undefined : promptFor({ kind: "shoulder", log }, client);
    }
    if (source.dataset.promptSled !== undefined) {
      const sled = client.getView().dragging;
      return sled === null ? undefined : promptFor({ kind: "sled", sledId: sled.id }, client);
    }
    const content = source.dataset.promptContent;
    if (content !== undefined && content in strings.backpackContents) {
      return promptFor({ kind: "backpackContent", content: content as BackpackContent }, client);
    }
    const chestContent = source.dataset.promptChestContent;
    if (chestContent !== undefined && chestContent in strings.backpackContents) return promptForChestContent(chestContent as BackpackContent);
    const button = source.dataset.promptButton;
    if (button === "build" || button === "craft") return promptForButton(button satisfies PromptButton, source.getAttribute("aria-pressed") === "true");
    return undefined;
  }

  function refresh(): void {
    const prompt = currentPrompt();
    const text = prompt === undefined ? "" : JSON.stringify(prompt);
    if (text === drawn) return;
    drawn = text;
    render(<CursorPromptView prompt={prompt} />, container);
  }

  function onPointerMove(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(PROMPT_SELECTOR) : null;
    if (target === hudElement) return;
    hudElement = target;
    refresh();
  }

  function onPointerLeave(): void {
    hudElement = null;
    sceneTarget = undefined;
    refresh();
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  const unsubscribe = client.subscribe(refresh);
  refresh();
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
      render(null, container);
      container.remove();
    },
  };
}

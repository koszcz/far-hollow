import { useState } from "preact/hooks";
import { seedFromText, type SaveSlotSummary } from "../sim/api";
import { strings } from "../strings";

export interface StartScreenProps {
  /** What each save slot holds, in slot order. */
  slots: readonly SaveSlotSummary[];
  /** Whether games can be saved in this browser. */
  canSave: boolean;
  /** Called when the player continues the game in a slot. Slots are numbered from 0. */
  onContinue: (slot: number) => void;
  /** Called when the player starts a new game in a slot. The seed is undefined if the player wants a random one. */
  onNewGame: (slot: number, seed: number | undefined) => void;
}

/** Lists the save slots. The player continues a saved game or starts a new one with a random or typed seed. */
export function StartScreen({ slots, canSave, onContinue, onNewGame }: StartScreenProps) {
  /** The slot the player is starting a new game in, or null while they are still choosing. */
  const [newGameSlot, setNewGameSlot] = useState<number | null>(null);
  const [seedText, setSeedText] = useState("");

  return (
    <main class="start-screen">
      <h1>{strings.gameTitle}</h1>
      {!canSave && <p class="start-screen-warning">{strings.startScreen.cannotSave}</p>}
      <ol class="start-screen-slots" aria-label={strings.startScreen.slots}>
        {slots.map((slot, index) => (
          <li key={index} class="start-screen-slot">
            <h2>{strings.startScreen.slot(index + 1)}</h2>
            <p>{describeSlot(slot)}</p>
            {newGameSlot === index ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onNewGame(index, seedFromText(seedText));
                }}
              >
                <label>
                  {strings.startScreen.seed}{" "}
                  <input
                    type="text"
                    value={seedText}
                    placeholder={strings.startScreen.randomSeed}
                    onInput={(event) => {
                      setSeedText(event.currentTarget.value);
                    }}
                  />
                </label>
                <p class="start-screen-hint">{strings.startScreen.seedHint}</p>
                {slot.state !== "empty" && <p class="start-screen-warning">{strings.startScreen.replaceWarning(index + 1)}</p>}
                <button type="submit" class="hud-button">{slot.state === "empty" ? strings.startScreen.start : strings.startScreen.replace}</button>{" "}
                <button
                  type="button"
                  class="hud-button"
                  onClick={() => {
                    setNewGameSlot(null);
                  }}
                >
                  {strings.startScreen.cancel}
                </button>
              </form>
            ) : (
              <p>
                {slot.state === "filled" && (
                  <button
                    type="button"
                    class="hud-button"
                    onClick={() => {
                      onContinue(index);
                    }}
                  >
                    {strings.startScreen.continueGame}
                  </button>
                )}{" "}
                <button
                  type="button"
                  class="hud-button"
                  onClick={() => {
                    setSeedText("");
                    setNewGameSlot(index);
                  }}
                >
                  {strings.startScreen.newGame}
                </button>
              </p>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}

function describeSlot(slot: SaveSlotSummary): string {
  switch (slot.state) {
    case "empty":
      return strings.startScreen.empty;
    case "broken":
      return strings.startScreen.broken;
    case "filled":
      return strings.startScreen.summary(slot.day, slot.seed);
  }
}

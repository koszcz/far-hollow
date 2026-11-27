import { useRef, useState } from "preact/hooks";
import { seedFromText } from "../sim/api";
import { type ImportRefusal, type SaveSlotSummary } from "../sim/api-save";
import type { VolumeControl } from "../sound/volume-control";
import { shellText } from "../strings/shell";
import { VolumeSlider } from "./sound-button";

export interface StartScreenProps {
  /** What each save slot holds, in slot order. */
  slots: readonly SaveSlotSummary[];
  /** Whether games can be saved in this browser. */
  canSave: boolean;
  /** Called when the player continues the game in a slot. Slots are numbered from 0. */
  onContinue: (slot: number) => void;
  /** Called when the player starts a new game in a slot. The seed is undefined if the player wants a random one. */
  onNewGame: (slot: number, seed: number | undefined) => void;
  /** Called when the player exports the saved game in a filled or broken slot to a file. */
  onExport: (slot: number) => void;
  /**
   * Called when the player picks a file to import into a slot.
   * Resolves to why the file was refused.
   * Resolves to undefined once the slot holds the imported game.
   */
  onImport: (slot: number, file: File) => Promise<ImportRefusal | undefined>;
  /** The player's Volume, which the start screen's slider sets. */
  volume: VolumeControl;
}

/** Lists the save slots. The player continues a saved game, starts a new one with a random or typed seed, or imports one from a file. */
export function StartScreen({ slots, canSave, onContinue, onNewGame, onExport, onImport, volume }: StartScreenProps) {
  /** The slot the player is starting a new game in, or null while they are still choosing. */
  const [newGameSlot, setNewGameSlot] = useState<number | null>(null);
  const [seedText, setSeedText] = useState("");
  /** The filled or broken slot whose replace warning shows before the player picks a file to import. */
  const [importWarningSlot, setImportWarningSlot] = useState<number | null>(null);
  /** Why the last import was refused, shown under its slot until the player's next action. */
  const [refusal, setRefusal] = useState<{ slot: number; reason: ImportRefusal } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /** The slot the file picker is open for. */
  const importSlot = useRef(0);

  /** Clears the reason the last import was refused. Any click, typing, or form submit on the start screen calls it. */
  function clearRefusal(): void {
    setRefusal(null);
  }

  function pickFile(slot: number): void {
    importSlot.current = slot;
    fileInput.current?.click();
  }

  return (
    <main class="start-screen" onClickCapture={clearRefusal} onInputCapture={clearRefusal} onSubmitCapture={clearRefusal}>
      <h1>{shellText.gameTitle}</h1>
      <div class="start-screen-volume">
        <VolumeSlider control={volume} />
      </div>
      {!canSave && <p class="start-screen-warning">{shellText.startScreen.cannotSave}</p>}
      {canSave && (
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            // Clear the choice, so picking the same file again still counts as a change.
            input.value = "";
            setImportWarningSlot(null);
            if (file === undefined) return;
            const slot = importSlot.current;
            void onImport(slot, file).then((reason) => {
              if (reason !== undefined) setRefusal({ slot, reason });
            });
          }}
        />
      )}
      <ol class="start-screen-slots" aria-label={shellText.startScreen.slots}>
        {slots.map((slot, index) => (
          <li key={index} class="start-screen-slot">
            <h2>{shellText.startScreen.slot(index + 1)}</h2>
            <p>{describeSlot(slot)}</p>
            {importWarningSlot === index ? (
              <>
                <p class="start-screen-warning">{shellText.startScreen.importWarning(index + 1)}</p>
                <p>
                  <button
                    type="button"
                    class="hud-button"
                    onClick={() => {
                      pickFile(index);
                    }}
                  >
                    {shellText.startScreen.chooseFile}
                  </button>{" "}
                  <button
                    type="button"
                    class="hud-button"
                    onClick={() => {
                      setImportWarningSlot(null);
                    }}
                  >
                    {shellText.startScreen.cancel}
                  </button>
                </p>
              </>
            ) : newGameSlot === index ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onNewGame(index, seedFromText(seedText));
                }}
              >
                <label>
                  {shellText.startScreen.seed}{" "}
                  <input
                    type="text"
                    value={seedText}
                    placeholder={shellText.startScreen.randomSeed}
                    onInput={(event) => {
                      setSeedText(event.currentTarget.value);
                    }}
                  />
                </label>
                <p class="start-screen-hint">{shellText.startScreen.seedHint}</p>
                {slot.state !== "empty" && <p class="start-screen-warning">{shellText.startScreen.replaceWarning(index + 1)}</p>}
                <button type="submit" class="hud-button">
                  {slot.state === "empty" ? shellText.startScreen.start : shellText.startScreen.replace}
                </button>{" "}
                <button
                  type="button"
                  class="hud-button"
                  onClick={() => {
                    setNewGameSlot(null);
                  }}
                >
                  {shellText.startScreen.cancel}
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
                    {shellText.startScreen.continueGame}
                  </button>
                )}{" "}
                <button
                  type="button"
                  class="hud-button"
                  onClick={() => {
                    setSeedText("");
                    setImportWarningSlot(null);
                    setNewGameSlot(index);
                  }}
                >
                  {shellText.startScreen.newGame}
                </button>
                {canSave && (
                  <>
                    {slot.state !== "empty" && (
                      <>
                        {" "}
                        <button
                          type="button"
                          class="hud-button"
                          onClick={() => {
                            onExport(index);
                          }}
                        >
                          {shellText.startScreen.exportGame}
                        </button>
                      </>
                    )}{" "}
                    <button
                      type="button"
                      class="hud-button"
                      onClick={() => {
                        setNewGameSlot(null);
                        if (slot.state === "empty") pickFile(index);
                        else setImportWarningSlot(index);
                      }}
                    >
                      {shellText.startScreen.importGame}
                    </button>
                  </>
                )}
              </p>
            )}
            {refusal?.slot === index && (
              <p class="start-screen-warning" role="alert">
                {shellText.startScreen.importRefusals[refusal.reason]}
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
      return shellText.startScreen.empty;
    case "broken":
      return shellText.startScreen.broken;
    case "filled":
      return shellText.startScreen.summary(slot.day, slot.seed);
  }
}

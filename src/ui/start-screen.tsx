import { useRef, useState } from "preact/hooks";
import { seedFromText, type SaveRefusal, type SaveSlotSummary } from "../sim/api";
import { strings } from "../strings";

/** Why the start screen could not import a file into a slot. `notStored`: the file was fine, but the browser could not store it. */
export type ImportRefusal = SaveRefusal | "notStored";

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
  /** Called when the player picks a file to import into a slot. Resolves to why the file was refused, or undefined once the slot holds the imported game. */
  onImport: (slot: number, file: File) => Promise<ImportRefusal | undefined>;
}

/** Lists the save slots. The player continues a saved game, starts a new one with a random or typed seed, or imports one from a file. */
export function StartScreen({ slots, canSave, onContinue, onNewGame, onExport, onImport }: StartScreenProps) {
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

  function pickFile(slot: number): void {
    importSlot.current = slot;
    fileInput.current?.click();
  }

  return (
    <main
      class="start-screen"
      // Any action on the start screen clears the reason the last import was refused.
      onClickCapture={() => {
        setRefusal(null);
      }}
      onInputCapture={() => {
        setRefusal(null);
      }}
    >
      <h1>{strings.gameTitle}</h1>
      {!canSave && <p class="start-screen-warning">{strings.startScreen.cannotSave}</p>}
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
      <ol class="start-screen-slots" aria-label={strings.startScreen.slots}>
        {slots.map((slot, index) => (
          <li key={index} class="start-screen-slot">
            <h2>{strings.startScreen.slot(index + 1)}</h2>
            <p>{describeSlot(slot)}</p>
            {importWarningSlot === index ? (
              <>
                <p class="start-screen-warning">{strings.startScreen.importWarning(index + 1)}</p>
                <p>
                  <button
                    type="button"
                    class="hud-button"
                    onClick={() => {
                      pickFile(index);
                    }}
                  >
                    {strings.startScreen.chooseFile}
                  </button>{" "}
                  <button
                    type="button"
                    class="hud-button"
                    onClick={() => {
                      setImportWarningSlot(null);
                    }}
                  >
                    {strings.startScreen.cancel}
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
                <button type="submit" class="hud-button">
                  {slot.state === "empty" ? strings.startScreen.start : strings.startScreen.replace}
                </button>{" "}
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
                    setImportWarningSlot(null);
                    setNewGameSlot(index);
                  }}
                >
                  {strings.startScreen.newGame}
                </button>
                {canSave && slot.state !== "empty" && (
                  <>
                    {" "}
                    <button
                      type="button"
                      class="hud-button"
                      onClick={() => {
                        onExport(index);
                      }}
                    >
                      {strings.startScreen.exportGame}
                    </button>
                  </>
                )}
                {canSave && (
                  <>
                    {" "}
                    <button
                      type="button"
                      class="hud-button"
                      onClick={() => {
                        setNewGameSlot(null);
                        if (slot.state === "empty") pickFile(index);
                        else setImportWarningSlot(index);
                      }}
                    >
                      {strings.startScreen.importGame}
                    </button>
                  </>
                )}
              </p>
            )}
            {refusal?.slot === index && (
              <p class="start-screen-warning" role="alert">
                {strings.startScreen.importRefusals[refusal.reason]}
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

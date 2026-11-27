// The journal: one HUD line under the clock that names the next goal, and the panel J opens, listing every goal.
// Text only, in the HUD's panel style. Its look lives in the .hud-journal rules of src/app/style.css.
import type { GameClient } from "../sim/api-client";
import type { JournalView } from "../sim/api-game-view";
import { strings } from "../strings";
import { journalLineText, journalSections } from "./journal-text";

/** The HUD line that names the next goal. Nothing shows while the journal is hidden, in the playground, or once every goal is done. */
export function JournalLine({ journal }: { journal: JournalView | null }) {
  const text = journalLineText(journal);
  if (text === null) return null;
  return (
    <div class="hud hud-journal-line">
      <p class="hud-panel">{text}</p>
    </div>
  );
}

/** The journal panel: the goals not yet done with their hints, the goals done, and the hide toggle. */
export function JournalPanel({ client, journal, onClose }: { client: GameClient; journal: JournalView; onClose: () => void }) {
  const { toDo, done, finished } = journalSections(journal);
  return (
    <section class="hud hud-journal hud-panel" aria-label={strings.journal.title}>
      <header class="hud-journal-header">
        <h3 class="hud-menu-title">{strings.journal.title}</h3>
        <button type="button" class="hud-journal-close" onClick={onClose}>
          {strings.journal.close}
        </button>
      </header>
      {finished !== null && <p class="hud-journal-finished">{finished}</p>}
      {toDo.length > 0 && (
        <>
          <h4 class="hud-journal-heading">{strings.journal.toDo}</h4>
          <ul class="hud-journal-goals">
            {toDo.map((entry) => (
              <li key={entry.goal}>
                <span class="hud-journal-name">{entry.name}</span>
                <span class="hud-journal-hint">{entry.hint}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <h4 class="hud-journal-heading">{strings.journal.done}</h4>
          <ul class="hud-journal-goals hud-journal-done">
            {done.map((entry) => (
              <li key={entry.goal}>
                <span class="hud-journal-name">{entry.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <label class="hud-journal-hide">
        <input
          type="checkbox"
          checked={journal.hidden}
          onChange={(event) => {
            client.send({ type: "setJournalHidden", hidden: event.currentTarget.checked });
            // Let go of focus, so J and Escape go back to the game.
            event.currentTarget.blur();
          }}
        />
        {strings.journal.hide}
      </label>
    </section>
  );
}

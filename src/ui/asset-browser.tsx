// The asset browser: /?assets on the dev server. A sidebar lists every catalogue asset by showcase family. The main view
// loads the chosen asset's showcase, /?asset=<id>, in a frame, and shows its catalogue entry. It is read-only: the owner
// approves assets in chat through the make-asset skill. The list logic is ./asset-browser-list.ts, the address ./asset-browser-address.ts.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AssetEntry } from "../../scripts/asset-manifest";
import { PLAY_SPEEDS, showcaseAddress, writeAddress, type BrowserAddress } from "./asset-browser-address";
import { groupAssets, neighbourId, type FamilyIds } from "./asset-browser-list";

export interface AssetBrowserProps {
  readonly entries: readonly AssetEntry[];
  readonly families: readonly FamilyIds[];
  /** The ids whose showcase can play live. */
  readonly playable: ReadonlySet<string>;
  /** The state the address held when the page opened. */
  readonly start: BrowserAddress;
}

export function AssetBrowser({ entries, families, playable, start }: AssetBrowserProps) {
  const [search, setSearch] = useState("");
  const [notApproved, setNotApproved] = useState(false);
  const [asset, setAsset] = useState(start.asset ?? entries[0]?.id);
  const [play, setPlay] = useState(start.play);
  const [speed, setSpeed] = useState(start.speed);
  const searchBox = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => groupAssets(entries, families, { search, notApproved }), [entries, families, search, notApproved]);
  const showcased = useMemo(() => new Set(families.flatMap((family) => family.ids)), [families]);

  // The address records the chosen asset, still views or play, and the speed, so a reload restores them.
  useEffect(() => {
    history.replaceState(null, "", writeAddress({ asset, play, speed }));
  }, [asset, play, speed]);

  // Up and down move through the list as shown. "/" moves to the search box.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "/" && document.activeElement !== searchBox.current) {
        event.preventDefault();
        searchBox.current?.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = neighbourId(groups, asset ?? "", event.key === "ArrowDown" ? 1 : -1);
        if (next !== undefined) setAsset(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [groups, asset]);

  // The chosen asset stays in sight as the arrow keys move through a long list.
  useEffect(() => {
    document.querySelector(".asset-browser-item.chosen")?.scrollIntoView({ block: "nearest" });
  }, [asset]);

  const entry = entries.find((candidate) => candidate.id === asset);
  return (
    <div class="asset-browser">
      <nav class="asset-browser-sidebar">
        <input
          ref={searchBox}
          class="asset-browser-search"
          type="search"
          placeholder="Search id or description ( / )"
          value={search}
          onInput={(event) => {
            setSearch(event.currentTarget.value);
          }}
        />
        <label class="asset-browser-filter">
          <input
            type="checkbox"
            checked={notApproved}
            onChange={(event) => {
              setNotApproved(event.currentTarget.checked);
            }}
          />
          Not approved
        </label>
        <div class="asset-browser-groups">
          {groups.map((group) => (
            <section key={group.name}>
              <h2>{group.name}</h2>
              <ul>
                {group.entries.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      class={`asset-browser-item${item.id === asset ? " chosen" : ""}`}
                      data-asset={item.id}
                      onClick={() => {
                        setAsset(item.id);
                      }}
                    >
                      <span class="asset-browser-id">{item.id}</span>
                      <span class={`asset-browser-status status-${item.approval.status}`}>{item.approval.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p class="asset-browser-empty">No asset matches.</p>}
        </div>
      </nav>
      <main class="asset-browser-main">
        {entry === undefined ? (
          <p class="asset-browser-empty">{asset === undefined ? "Pick an asset." : `"${asset}" is not in the asset catalogue.`}</p>
        ) : (
          <ChosenAsset
            entry={entry}
            hasShowcase={showcased.has(entry.id)}
            canPlay={playable.has(entry.id)}
            play={play}
            speed={speed}
            setPlay={setPlay}
            setSpeed={setSpeed}
          />
        )}
      </main>
    </div>
  );
}

interface ChosenAssetProps {
  readonly entry: AssetEntry;
  readonly hasShowcase: boolean;
  readonly canPlay: boolean;
  readonly play: boolean;
  readonly speed: BrowserAddress["speed"];
  readonly setPlay: (play: boolean) => void;
  readonly setSpeed: (speed: BrowserAddress["speed"]) => void;
}

/** The chosen asset: its showcase in a frame, with the view and speed controls, and its catalogue entry. */
function ChosenAsset({ entry, hasShowcase, canPlay, play, speed, setPlay, setSpeed }: ChosenAssetProps) {
  // Play stays chosen while the owner looks at an asset that cannot play, so it is back for the next one that can.
  const playing = play && canPlay;
  const address = showcaseAddress(entry.id, playing, speed);
  return (
    <>
      {hasShowcase && (
        <div class="asset-browser-controls">
          <div class="asset-browser-switch" role="group" aria-label="View">
            <button
              type="button"
              class={playing ? "" : "chosen"}
              onClick={() => {
                setPlay(false);
              }}
            >
              Four still views
            </button>
            <button
              type="button"
              class={playing ? "chosen" : ""}
              disabled={!canPlay}
              onClick={() => {
                setPlay(true);
              }}
            >
              Live play
            </button>
          </div>
          <div class="asset-browser-switch" role="group" aria-label="Speed">
            {PLAY_SPEEDS.map((offered) => (
              <button
                key={offered}
                type="button"
                class={offered === speed ? "chosen" : ""}
                disabled={!playing}
                onClick={() => {
                  setSpeed(offered);
                }}
              >
                {offered}×
              </button>
            ))}
          </div>
          <a class="asset-browser-open" href={address} target="_blank" rel="noopener">
            Open alone
          </a>
        </div>
      )}
      {hasShowcase ? (
        <iframe key={address} class="asset-browser-frame" src={address} title={`Showcase of ${entry.id}`} />
      ) : (
        <p class="asset-browser-no-showcase">No showcase</p>
      )}
      <dl class="asset-browser-entry">
        <dt>Asset</dt>
        <dd>
          {entry.id} <span class={`asset-browser-status status-${entry.approval.status}`}>{entry.approval.status}</span>
        </dd>
        <dt>Description</dt>
        <dd>{entry.description}</dd>
        <dt>Source</dt>
        <dd>{entry.source}</dd>
        <dt>Licence</dt>
        <dd>{entry.license}</dd>
        <dt>Code files</dt>
        <dd>
          {entry.code.length === 0 ? (
            "None"
          ) : (
            <ul>
              {entry.code.map((file) => (
                <li key={file}>
                  <code>{file}</code>
                </li>
              ))}
            </ul>
          )}
        </dd>
        {entry.kind === "file" && (
          <>
            <dt>File</dt>
            <dd>
              <code>{entry.file}</code>
            </dd>
          </>
        )}
      </dl>
    </>
  );
}

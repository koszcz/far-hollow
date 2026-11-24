// The asset browser's address, such as /?assets=bed&play&speed=0.25, and the showcase address it opens in its frame.
// Pure functions only. The page is src/ui/asset-browser.tsx.

/** The speeds the browser offers for live play, as times game speed. */
export const PLAY_SPEEDS = [0.25, 0.5, 1, 2] as const;
export type PlaySpeed = (typeof PLAY_SPEEDS)[number];

/** What the browser's address records: the chosen asset, still views or live play, and the play speed. */
export interface BrowserAddress {
  /** The chosen asset's id, or undefined when none is chosen yet. */
  readonly asset: string | undefined;
  readonly play: boolean;
  readonly speed: PlaySpeed;
}

/** Reads the browser's state from the address's query, such as "?assets=bed&play&speed=0.25". Unknown speeds read as 1. */
export function readAddress(query: string): BrowserAddress {
  const params = new URLSearchParams(query);
  const asset = params.get("assets") ?? "";
  const speed = PLAY_SPEEDS.find((offered) => offered === Number(params.get("speed"))) ?? 1;
  return { asset: asset === "" ? undefined : asset, play: params.has("play"), speed };
}

/** Writes the browser's state as an address query. Play and a speed other than 1 show only when set. */
export function writeAddress(address: BrowserAddress): string {
  const asset = address.asset === undefined ? "" : `=${encodeURIComponent(address.asset)}`;
  return `?assets${asset}${optionsQuery(address.play, address.speed)}`;
}

/** The bare showcase's address for this asset, with live play and its speed when `play` is set. Stills take no speed. */
export function showcaseAddress(asset: string, play: boolean, speed: PlaySpeed): string {
  return `/?asset=${encodeURIComponent(asset)}${play ? optionsQuery(true, speed) : ""}`;
}

function optionsQuery(play: boolean, speed: PlaySpeed): string {
  return `${play ? "&play" : ""}${speed === 1 ? "" : `&speed=${speed}`}`;
}

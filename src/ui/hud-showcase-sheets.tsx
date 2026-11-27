// The icon sheets that replace one view of a HUD showcase: each icon drawn large, with its name, so the owner can judge the drawings.
import type { BackpackContent, StructureKind } from "../sim/api";
import { QUEUE_THING_DRAWINGS, type QueueThing } from "./action-queue-icons";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import { MaterialIcon } from "./build-icons";
import { StructureIcon } from "./structure-icon";
import { LIT_TORCH_DRAWING, TORCH_DRAWING } from "./torch-icons";
import { JUG_DRAWINGS, UNFIRED_JUG_DRAWING } from "./jug-icons";
import { FULL_BUILD_MENU } from "./hud-showcase-view";

/** Every structure with an icon, in the order the "build-icons" sheet draws them: the build menu's structures, with each add-on after its host. */
const ICON_SHEET_STRUCTURES: readonly StructureKind[] = FULL_BUILD_MENU.flatMap(({ structure }) => {
  if (structure === "roofFrame") return [structure, "roof", "door", "shutters"];
  if (structure === "fireplace") return [structure, "chimney"];
  return [structure];
});

/** The "action-queue-icons" first view: each drawn icon large, with its name, so the owner can judge the drawings. */
export function QueueIconSheet() {
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
      {(Object.keys(QUEUE_THING_DRAWINGS) as QueueThing[]).map((thing) => (
        <div
          key={thing}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "96px", height: "96px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={QUEUE_THING_DRAWINGS[thing]} className="backpack-icon" />
          </span>
          {thing}
        </div>
      ))}
    </div>
  );
}

/** The "build-icons" first view: every build icon drawn large, with its name, so the owner can judge the drawings. */
export function BuildIconSheet() {
  const cell = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    padding: "4px",
    background: "#3d2b1e",
    borderRadius: "6px",
    color: "#cdb898",
    fontSize: "11px",
  } as const;
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
      {ICON_SHEET_STRUCTURES.map((structure) => (
        <div key={structure} style={cell}>
          <span style={{ width: "64px", height: "64px", display: "grid" }} class="showcase-big-icon">
            <StructureIcon structure={structure} />
          </span>
          {structure}
        </div>
      ))}
      {(["log", "debarkedLog"] as const).map((material) => (
        <div key={material} style={cell}>
          <span style={{ width: "64px", height: "64px", display: "grid" }} class="showcase-big-icon">
            <MaterialIcon material={material} />
          </span>
          {material}
        </div>
      ))}
    </div>
  );
}

/** The furniture icons the "rain-barrel-icon", "drying-rack-icon", and "wood-box-icon" sheets draw beside their piece, so the owner can compare their style. */
const FURNITURE_ICON_NEIGHBOURS = ["chest", "table", "stool", "bed"] as const;

/**
 * The first view of "rain-barrel-icon", "drying-rack-icon", or "wood-box-icon": the piece's icon drawn large and at build menu size, beside four other
 * furniture icons. The full build icon sheet does not fit the piece in a quarter of the screen.
 */
export function FurnitureIconSheet({ piece }: { piece: "rainBarrel" | "dryingRack" | "woodBox" }) {
  const cell = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "6px",
    background: "#3d2b1e",
    borderRadius: "6px",
    color: "#cdb898",
    fontSize: "11px",
  } as const;
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "flex", gap: "6px" }}>
      <div style={cell}>
        <span style={{ width: "160px", height: "160px", display: "grid" }} class="showcase-big-icon">
          <StructureIcon structure={piece} />
        </span>
        <span style={{ width: "40px", height: "40px", display: "grid" }} class="showcase-big-icon">
          <StructureIcon structure={piece} />
        </span>
        {piece}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
        {FURNITURE_ICON_NEIGHBOURS.map((structure) => (
          <div key={structure} style={cell}>
            <span style={{ width: "72px", height: "72px", display: "grid" }} class="showcase-big-icon">
              <StructureIcon structure={structure} />
            </span>
            {structure}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The last view of "crafting-icons" or "fishing-icons": each icon drawn large, with its name, so the owner can judge the drawings. */
export function IconSheet({ contents }: { contents: readonly BackpackContent[] }) {
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
      {contents.map((content) => (
        <div
          key={content}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "96px", height: "96px", display: "grid" }} class="showcase-big-icon">
            <BackpackIcon content={content} />
          </span>
          {content}
        </div>
      ))}
    </div>
  );
}

/** The second view of "torch-icons": the unlit and lit torch drawn large and at hotbar size, so the owner can judge the drawings. */
export function TorchIconSheet() {
  const drawings = [
    ["torch", TORCH_DRAWING],
    ["lit torch", LIT_TORCH_DRAWING],
  ] as const;
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
      {drawings.map(([name, drawing]) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "160px", height: "160px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          <span style={{ width: "32px", height: "32px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          {name}
        </div>
      ))}
    </div>
  );
}

/** The jug icons that the "jug-icons" icon sheet draws, with their names. */
const JUG_SHEET_ICONS = [
  { drawing: UNFIRED_JUG_DRAWING, name: "unfired jug" },
  { drawing: JUG_DRAWINGS.jug, name: "empty jug" },
  { drawing: JUG_DRAWINGS.jugWith1Drink, name: "jug with 1 drink" },
  { drawing: JUG_DRAWINGS.jugWith2Drinks, name: "jug with 2 drinks" },
  { drawing: JUG_DRAWINGS.jugWith3Drinks, name: "jug with 3 drinks" },
] as const;

/** The second view of "jug-icons": each jug icon drawn large and at hotbar size, so the owner can judge the drawing. */
export function JugIconSheet() {
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
      {JUG_SHEET_ICONS.map(({ drawing, name }) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "160px", height: "160px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          <span style={{ width: "32px", height: "32px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          {name}
        </div>
      ))}
    </div>
  );
}

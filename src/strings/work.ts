import { FETCH_METRES } from "../sim/building-sources";

export const workText = {
  chopping: "Chopping",
  splitting: "Splitting",
  debarking: "Debarking",
  debark: "Debark",
  building: "Building",
  takingDown: "Taking down",
  takeDown: "Take down",
  crafting: "Crafting",
  fishing: "Fishing",
  gatheringStone: "Gathering stone",
  diggingClay: "Digging clay",
  diggingUp: "Digging up",
  planting: "Planting",
  plantingMushroom: "Planting a mushroom",
  /** The hint while a see-through sapling or berry bush follows the mouse. */
  plantingHint: {
    what: { sapling: "Planting: Sapling. Click the ground to plant it.", berryBush: "Planting: Berry bush. Click the ground to plant it." },
    refused: (reason: string) => `Cannot plant here: ${reason}.`,
  },
  craftMenu: {
    open: "Craft",
    title: "Craft",
    recipes: {
      saw: "Saw",
      planks: "Cut planks",
      fishingRod: "Fishing rod",
      torch: "Torch",
      unfiredJug: "Unfired jug",
      cord: "Cord",
      fishTrap: "Fish trap",
    },
    /** What a station recipe uses from the ground beside its station, such as "1 debarked log by the sawhorse". */
    besideStation: (materials: string, station: string) => `${materials} by the ${station.toLowerCase()}`,
    /** Logs and debarked logs a station recipe uses from the ground, by how many. */
    groundMaterials: {
      log: (count: number) => (count === 1 ? "1 log" : `${count} logs`),
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
    },
    /** What a recipe uses and how long it takes, such as "Saw blade, Stick ×3 · 5 s". */
    cost: (materials: readonly string[], seconds: number) => `${materials.join(", ")} · ${seconds} s`,
    /** Each thing a recipe can lack, as the craft menu and notices name it. */
    lacking: {
      /** A tool that is not in the backpack, such as "the saw". */
      tool: (tool: string) => `the ${tool.toLowerCase()}`,
      /** A work station that does not stand yet, such as "a sawhorse". */
      station: (station: string) => `a ${station.toLowerCase()}`,
      materials: "more materials",
    },
    /** What the craft menu says a recipe lacks, such as "needs the saw and a sawhorse". */
    needs: (lacking: readonly string[]) => `needs ${lacking.join(" and ")}`,
  },
  buildMenu: {
    open: "Build",
    title: "Build",
    /** The names of the build menu's tabs. */
    tabs: { camp: "Camp", shelter: "Shelter", furniture: "Furniture" },
    /** The detail line on a host's row, which names the add-on the player builds from it. */
    addOnDetail: {
      doorFrame: "Hang a door in it once it is built.",
      window: "Hang shutters in it once it is built.",
      roofFrame: "Lay the roof on it once it is built.",
      fireplace: "Build a chimney on it once it is built.",
    },
    structures: {
      campfire: "Campfire",
      leanTo: "Lean-to",
      foundation: "Foundation",
      floor: "Floor",
      logWall: "Log wall",
      doorFrame: "Door frame",
      window: "Window",
      roofFrame: "Roof frame",
      roof: "Roof section",
      door: "Door",
      shutters: "Shutters",
      fireplace: "Fireplace",
      chimney: "Chimney",
      woodpile: "Woodpile",
      chest: "Chest",
      shelf: "Shelf",
      bed: "Bed",
      table: "Table",
      stool: "Stool",
      rainBarrel: "Rain barrel",
      dryingRack: "Drying rack",
      woodBox: "Wood box",
      sawhorse: "Sawhorse",
      sled: "Sled",
    },
    materials: {
      stick: (count: number) => (count === 1 ? "1 stick" : `${count} sticks`),
      bark: (count: number) => `${count} bark`,
      cord: (count: number) => (count === 1 ? "1 cord" : `${count} cords`),
      plank: (count: number) => (count === 1 ? "1 plank" : `${count} planks`),
      stone: (count: number) => (count === 1 ? "1 stone" : `${count} stones`),
      log: (count: number) => (count === 1 ? "1 log" : `${count} logs`),
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
    },
    cost: (materials: readonly string[]) => materials.join(", "),
    /**
     * The full name of a build menu row, for screen readers, such as "Campfire: 5 sticks". A structure that costs nothing has only its name.
     * A host's row adds its detail line after a " · ", such as "Hang a door in it once it is built."
     */
    entryLabel: (structure: string, cost: string, detail?: string) =>
      [cost === "" ? structure : `${structure}: ${cost}`, ...(detail === undefined ? [] : [detail])].join(" · "),
    /** What to click while placing each kind of structure, given its name. The keys show after it, from `hudLabels.placingKeys`. */
    /** The placing hint when the game refuses the spot under the mouse and says why. */
    refusedHere: (structure: string, reason: string) => `Cannot place a ${structure} here: ${reason}.`,
    placing: {
      anywhere: (structure: string) => `Placing: ${structure}. Click the ground or a floor to place it anywhere.`,
      onGround: (structure: string) => `Placing: ${structure}. Click the ground to place it.`,
      onFoundation: (structure: string) => `Placing: ${structure}. Point at a finished foundation and click to place it. R turns it.`,
      underfoot: (structure: string) =>
        `Placing: ${structure}. Point at a finished foundation and click to place it. Hold Shift and drag to place one on each square.`,
      onEdge: (structure: string) => `Placing: ${structure}. Point at a finished foundation and click to place it on an edge. R picks another edge.`,
      overWalls: (structure: string) =>
        `Placing: ${structure}. Point at a finished foundation with a wall, door frame, or window on its edge, and click to place it. R turns the way it slopes down.`,
      onFrame: (structure: string) => `Placing: ${structure}. Point at a finished roof frame and click to place it. It slopes the way the frame does.`,
      inDoorFrame: (structure: string) => `Placing: ${structure}. Point at a finished door frame with no door, and click to hang it there.`,
      inWindow: (structure: string) => `Placing: ${structure}. Point at a finished window with no shutters, and click to hang them there.`,
      onFireplace: (structure: string) => `Placing: ${structure}. Point at a finished fireplace with no chimney, and click to place it there.`,
    },
  },
  /** Labels that name the HUD's buttons and bars, and the keys that work them. */
  hudLabels: {
    /** The key that opens the build menu, shown on its button. */
    buildKey: "B",
    /** The key that opens the craft menu, shown on its button. */
    craftKey: "C",
    /** The keys that work while placing a structure, shown after the placing hint. */
    placingKeys: {
      rotate: "R to rotate",
      cancel: "Esc to cancel",
      /** Placing floors goes on after each click, so Esc stops it rather than cancelling one placement. */
      stop: "Esc to stop",
      join: (keys: readonly string[]) => keys.join(" · "),
    },
  },
  blueprint: {
    title: (structure: string) => `Blueprint: ${structure}`,
    deliveries: {
      log: (has: number, needs: number) => `Logs: ${has} of ${needs}`,
      debarkedLog: (has: number, needs: number) => `Debarked logs: ${has} of ${needs}`,
      plank: (has: number, needs: number) => `Planks: ${has} of ${needs}`,
      stone: (has: number, needs: number) => `Stone: ${has} of ${needs}`,
    },
    /** How to add the material the blueprint still waits for. */
    deliverHint: {
      log: `Lay logs within ${FETCH_METRES} m of the blueprint, and you fetch them as you build. You can also carry one here and click the blueprint to add it.`,
      debarkedLog: `Lay debarked logs within ${FETCH_METRES} m of the blueprint, and you fetch them as you build. You can also carry one here and click the blueprint to add it.`,
      plank: `Bring planks in your backpack, or lay them within ${FETCH_METRES} m of the blueprint, and click the blueprint to build with them.`,
      stone: `Bring stone in your backpack, or lay it within ${FETCH_METRES} m of the blueprint, and click the blueprint to build with it.`,
    },
    buildHint: "Click the blueprint to build it. Click elsewhere or press Escape to stop.",
  },
} as const;

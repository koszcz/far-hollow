export const campText = {
  campfire: "Campfire",
  fireplace: "Fireplace",
  campfireLit: "Burning",
  campfireUnlit: "Not lit",
  campfireFuel: "Fuel",
  potBoiling: "Boiling",
  potBoiled: "The water has boiled.",
  /** One fish on the campfire, as the campfire's panel lists it. */
  fishCooking: "Cooking",
  fishCooked: "Cooked",
  /** The jug on the campfire, as the campfire's panel shows it. */
  jugFiring: "Firing",
  jugFired: "Fired",
  woodpile: {
    title: "Woodpile",
    fill: "Stacked",
    count: (total: number, capacity: number) => `${total} of ${capacity}`,
    contents: {
      log: (count: number) => (count === 1 ? "1 log" : `${count} logs`),
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
      firewood: (count: number) => (count === 1 ? "1 piece of firewood" : `${count} pieces of firewood`),
    },
  },
  rainBarrel: {
    title: "Rain barrel",
    fill: "Water",
    /** How many drinks of clean water the barrel holds, out of the most it holds. */
    count: (drinks: number, limit: number) => `${drinks} of ${limit} drinks`,
    underRoof: "Under a roof: catches no rain.",
  },
  dryingRack: {
    title: "Drying rack",
    /** How many foods hang on the rack, out of the most it holds. */
    count: (held: number, limit: number) => `${held} of ${limit}`,
    /** One food on the rack, as the rack's panel lists it. */
    drying: "Drying",
    dried: "Dried",
    smoking: "Smoking",
    smoked: "Smoked",
    /** Raw fish on the rack that is not smoking, because no lit fire stands close by. Short, so it fits beside the bar. */
    noFire: "No fire",
    empty: "Nothing hangs here. Hang berries or mushrooms to dry them, or raw fish beside a lit fire to smoke it.",
  },
  woodBox: {
    title: "Wood box",
    fill: "Firewood",
    /** How many pieces of firewood the box holds, out of the most it holds. */
    count: (firewood: number, limit: number) => `${firewood} of ${limit} firewood`,
  },
} as const;

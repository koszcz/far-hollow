import { listText, capitalise } from "./text";

export const bodyText = {
  warmth: "Warmth",
  needs: "Needs",
  hunger: "Hunger",
  raining: "It is raining. The rain chills you.",
  snowing: "It is snowing. The snow chills you.",
  thirst: "Thirst",
  sick: "Sick: your needs drain faster. Rest to recover sooner.",
  /** The hint above the need gauges when one or more needs are low enough to slow the player. */
  lowNeeds: {
    /** How each low need makes the player feel, such as "hungry". */
    feeling: { hunger: "hungry", thirst: "thirsty", warmth: "cold", fatigue: "tired" },
    /** What the player does to fill each low need, such as "eat". */
    remedy: { hunger: "eat", thirst: "drink", warmth: "warm up by a fire", fatigue: "rest" },
    /** Such as "Hungry and cold: you move and work more slowly. Eat and warm up by a fire." */
    slowed: (feelings: readonly string[], remedies: readonly string[]) =>
      `${capitalise(listText(feelings))}: you move and work more slowly. ${capitalise(listText(remedies))}.`,
    /** Added when a need is empty. */
    collapseSoon: "If a need stays empty for an hour, you collapse.",
  },
  fatigue: "Rest",
} as const;

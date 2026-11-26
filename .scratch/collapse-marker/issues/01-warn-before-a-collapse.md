# 01: Warn the player before a collapse

**What to build:** The player gets a fair warning before every collapse. Today a sleep runs the clock forward in one jump, so a need can run empty and stay empty for the whole collapse countdown while the player sleeps. The player lies down with a gauge a third full and sees only "You collapsed." After this ticket, a need that runs empty wakes the player, the sleep choice warns ahead of time, and an empty gauge counts down to the collapse.

**Status:** ready-for-agent

**Blocked by:** None

**Assets:** None. The countdown ring is HUD styling, not an asset. Settled 2026-11-26.

## Waking before a collapse

- [ ] When a need other than fatigue runs empty while the player sleeps, the sleep ends at that minute. The player wakes where they slept, with no collapse.
- [ ] A need that fills during sleep never wakes the player. Fatigue fills in sleep, and warmth fills beside a lit campfire.
- [ ] The wake notice names every need that is empty at waking, in the HUD order, such as "You woke up thirsty and hungry."
- [ ] After waking, the collapse countdown runs in real time as it does when the player is awake.
- [ ] The debug skips (skip hours, skip to rain change, skip to next season) keep today's behaviour. Only sleep wakes the player.
- [ ] The `sleep` and `sleepInBed` command docs in `src/sim/api.ts` say that a need running empty wakes the player.

## Refusing sleep with an empty need

- [ ] Sleep on a bedroll or in a bed is refused while a need is already empty and would keep draining in the sleep. The refusal names the need and its remedy, such as "You're too thirsty to sleep. Drink first." (ADR 0008).
- [ ] Empty fatigue never blocks sleep. Empty warmth does not block sleep while the player would sleep within a lit campfire's warmth range.
- [ ] The sleep choice in the action menu shows greyed, with the reason, as other refused actions do.

## Warning on the sleep choice

- [ ] When a need will run empty before the sleep would end, the sleep choice in the action menu shows a warning line, such as "You'll wake up thirsty in the night." The choice stays usable.
- [ ] The warning names every need that will run empty, in the HUD order.
- [ ] The prediction uses the sleep's length and the conditions at the moment the player would lie down: season, night, roof, bed, snug room, sickness, rain, and campfire warmth. It need not foresee a fire burning out or rain starting during the sleep.
- [ ] The prediction and the wake rule share one calculation of how needs change over a sleep, so they agree when conditions do not change (ADR 0009).

## Collapse countdown on the gauges

- [ ] While a need is empty, its gauge ring turns red and fills back up as the collapse countdown runs. The ring is full and red one moment before the collapse.
- [ ] Each empty need's ring counts down its own countdown.
- [ ] The low needs hint replaces "If a need stays empty for an hour, you collapse." with the time left for the need that runs out first, in game minutes, such as "You collapse in 40 minutes."
- [ ] The game view gives each need's countdown, so the HUD does not work it out itself (ADR 0005).
- [ ] The HUD showcase shows a gauge partway through its countdown.

## Saving and the rest

- [ ] The new notices are saved like the other notices. Older saves still load (ADR 0011).
- [ ] The collapse notice stays as it is. Naming the need on it belongs to ticket 02.
- [ ] `GLOSSARY.md` defines the collapse countdown, and "Collapse" says it never happens in sleep. This is done already.

// Plays sounds through the browser's Web Audio. It plays what it is told each frame and never reads or changes game state.
// Browsers block sound until the player clicks, so it starts on the first click or key press.
import { audibleVolume, type VolumeControl } from "./volume-control";
import { ambienceLoop } from "./ambience-loops";
import { soundsToPlay, type SoundId, type SoundWish } from "./sound-mix";

/** How fast a playing sound follows a change in loudness or side, in seconds. Short enough to keep up, long enough not to click. */
const FOLLOW_SECONDS = 0.08;
/** How fast all sound fades in again when the tab is shown, in seconds. */
const FADE_IN_SECONDS = 0.5;
/** A sound that stops fades out over about this long first, in seconds. */
const FADE_OUT_SECONDS = 0.1;
/** Changes smaller than this are not sent to the browser, which keeps each frame cheap. */
const SMALLEST_CHANGE = 0.002;

/** One sound as it plays now, for tests and the dev build. */
export interface PlayingSound {
  readonly key: string;
  readonly sound: SoundId;
  /** How loud it plays before the Volume, from 0 to 1. */
  readonly loudness: number;
  /** Which side it comes from: -1 fully left, 0 in the middle, 1 fully right. */
  readonly pan: number;
}

/** What the sound engine plays now. The dev build shows it on `window.farHollow.sound()`. */
export interface SoundState {
  /** Whether the browser lets the game play sound yet. It does after the player's first click. */
  readonly started: boolean;
  readonly volume: number;
  readonly muted: boolean;
  /** Whether the tab is hidden, so all sound stops. */
  readonly hidden: boolean;
  /** How loud all sound plays after the Volume, mute, and the sleep fade, from 0 to 1. */
  readonly overall: number;
  /** Every sound playing, loudest first. Each one's heard loudness is its loudness times `overall`. */
  readonly playing: readonly PlayingSound[];
  /** How long the last frame's sound work took, in milliseconds. */
  readonly frameMs: number;
}

export interface SoundEngine {
  /** Lets the browser play sound. Call it from a click or key press. Later calls do nothing. */
  start(): void;
  /**
   * Plays these sounds from now on, the loudest MAX_SOUNDS of them, and stops the rest.
   * `silence` runs from 0 (as loud as the Volume) to 1 (silent), such as while the sleep animation fades to black.
   */
  play(wishes: readonly SoundWish[], silence: number): void;
  /** Stops all sound while the tab is hidden, and fades it back in when the tab is shown. */
  setHidden(hidden: boolean): void;
  /** Records how long the last frame's sound work took, in milliseconds, including working out what to play. */
  recordFrameMs(ms: number): void;
  state(): SoundState;
}

/** The browser's sound parts that one playing sound uses. */
interface Voice {
  readonly sound: SoundId;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  readonly panner: StereoPannerNode;
  loudness: number;
  pan: number;
}

export function createSoundEngine(volume: VolumeControl): SoundEngine {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  const buffers = new Map<SoundId, AudioBuffer>();
  const voices = new Map<string, Voice>();
  let playing: PlayingSound[] = [];
  let silence = 0;
  let hidden = false;
  let fadingInUntil = 0;
  let frameMs = 0;
  /** The loudness last sent to the master gain, so it is sent again only when it changes. */
  let masterTarget = 0;

  function overall(): number {
    return hidden ? 0 : audibleVolume(volume.setting()) * (1 - Math.min(1, Math.max(0, silence)));
  }

  function setMaster(): void {
    if (context === undefined || master === undefined) return;
    const target = overall();
    if (Math.abs(target - masterTarget) <= SMALLEST_CHANGE) return;
    const follow = context.currentTime < fadingInUntil ? FADE_IN_SECONDS / 3 : FOLLOW_SECONDS;
    master.gain.setTargetAtTime(target, context.currentTime, follow);
    masterTarget = target;
  }
  volume.subscribe(setMaster);

  function bufferOf(audio: AudioContext, sound: SoundId): AudioBuffer {
    const made = buffers.get(sound);
    if (made !== undefined) return made;
    const samples = ambienceLoop(sound, audio.sampleRate);
    const buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
    buffer.copyToChannel(samples, 0);
    buffers.set(sound, buffer);
    return buffer;
  }

  function startVoice(audio: AudioContext, out: AudioNode, wish: SoundWish): Voice {
    const source = audio.createBufferSource();
    source.buffer = bufferOf(audio, wish.sound);
    source.loop = true;
    const gain = audio.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(wish.loudness, audio.currentTime, FOLLOW_SECONDS);
    const panner = audio.createStereoPanner();
    panner.pan.value = wish.pan;
    source.connect(gain).connect(panner).connect(out);
    // Each sound starts somewhere in its loop, so two fires never crackle in step.
    const buffer = source.buffer;
    source.start(audio.currentTime, Math.random() * buffer.duration);
    return { sound: wish.sound, source, gain, panner, loudness: wish.loudness, pan: wish.pan };
  }

  function stopVoice(audio: AudioContext, voice: Voice): void {
    voice.gain.gain.setTargetAtTime(0, audio.currentTime, FADE_OUT_SECONDS / 3);
    voice.source.stop(audio.currentTime + FADE_OUT_SECONDS * 2);
    voice.source.onended = () => {
      voice.panner.disconnect();
    };
  }

  function mix(audio: AudioContext, out: AudioNode): void {
    const wanted = new Set(playing.map((sound) => sound.key));
    for (const [key, voice] of voices) {
      if (wanted.has(key)) continue;
      stopVoice(audio, voice);
      voices.delete(key);
    }
    for (const wish of playing) {
      const voice = voices.get(wish.key);
      if (voice === undefined) {
        voices.set(wish.key, startVoice(audio, out, wish));
        continue;
      }
      if (Math.abs(voice.loudness - wish.loudness) > SMALLEST_CHANGE) {
        voice.gain.gain.setTargetAtTime(wish.loudness, audio.currentTime, FOLLOW_SECONDS);
        voice.loudness = wish.loudness;
      }
      if (Math.abs(voice.pan - wish.pan) > SMALLEST_CHANGE) {
        voice.panner.pan.setTargetAtTime(wish.pan, audio.currentTime, FOLLOW_SECONDS);
        voice.pan = wish.pan;
      }
    }
  }

  return {
    start() {
      if (context !== undefined) {
        if (context.state === "suspended" && !hidden) void context.resume();
        return;
      }
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      fadingInUntil = context.currentTime + FADE_IN_SECONDS;
      setMaster();
      mix(context, master);
    },
    play(wishes, silenceNow) {
      silence = silenceNow;
      playing = soundsToPlay(wishes).map(({ key, sound, loudness, pan }) => ({ key, sound, loudness, pan }));
      if (context === undefined || master === undefined || hidden) return;
      setMaster();
      mix(context, master);
    },
    setHidden(hiddenNow) {
      if (hiddenNow === hidden) return;
      hidden = hiddenNow;
      if (context === undefined || master === undefined) return;
      if (hidden) {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0, context.currentTime);
        masterTarget = 0;
        void context.suspend();
        return;
      }
      const audio = context;
      void audio.resume().then(() => {
        fadingInUntil = audio.currentTime + FADE_IN_SECONDS;
        setMaster();
      });
    },
    recordFrameMs(ms) {
      frameMs = ms;
    },
    state() {
      const setting = volume.setting();
      return {
        started: context !== undefined,
        volume: setting.volume,
        muted: setting.muted,
        hidden,
        overall: overall(),
        playing,
        frameMs,
      };
    },
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { startAutosave } from "./autosave";

describe("autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setUp() {
    const page = new EventTarget();
    let hidden = false;
    const save = vi.fn();
    const stop = startAutosave({ save, intervalMs: 1000, page, isHidden: () => hidden });
    return {
      save,
      stop,
      hide: () => {
        hidden = true;
        page.dispatchEvent(new Event("visibilitychange"));
      },
      show: () => {
        hidden = false;
        page.dispatchEvent(new Event("visibilitychange"));
      },
      close: () => page.dispatchEvent(new Event("pagehide")),
    };
  }

  it("saves at a regular interval", () => {
    const { save } = setUp();
    vi.advanceTimersByTime(999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("saves when the page is hidden, but not when it is shown again", () => {
    const { save, hide, show } = setUp();
    hide();
    expect(save).toHaveBeenCalledTimes(1);
    show();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves when the page is closed", () => {
    const { save, close } = setUp();
    close();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("stops saving once stopped", () => {
    const { save, stop, hide, close } = setUp();
    stop();
    vi.advanceTimersByTime(5000);
    hide();
    close();
    expect(save).not.toHaveBeenCalled();
  });
});

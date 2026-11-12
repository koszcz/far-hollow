import { describe, expect, it } from "bun:test";
import { createCameraRig } from "./camera-rig";

const degrees = (value: number) => (value * Math.PI) / 180;

describe("camera pitch", () => {
  it("never tilts flatter than 20°", () => {
    const rig = createCameraRig();
    rig.tilt(degrees(-500));
    expect(rig.pitch).toBeCloseTo(degrees(20));
  });

  it("never tilts steeper than 75°", () => {
    const rig = createCameraRig();
    rig.tilt(degrees(500));
    expect(rig.pitch).toBeCloseTo(degrees(75));
  });
});

describe("camera position", () => {
  it("sits up and back from the point it looks at, at the current pitch and distance", () => {
    const rig = createCameraRig();
    rig.zoomBy(0.0001);
    rig.zoomBy(10 / 8);
    rig.tilt(degrees(-100));
    const { eye, focus } = rig.view();
    expect(Math.hypot(eye.x - focus.x, eye.y - focus.y, eye.z - focus.z)).toBeCloseTo(10);
    expect(eye.y - focus.y).toBeCloseTo(10 * Math.sin(degrees(20)));
  });

  it("circles the point it looks at when rotated a half turn", () => {
    const rig = createCameraRig();
    const before = rig.view();
    rig.rotate(Math.PI);
    const after = rig.view();
    expect(after.focus).toEqual(before.focus);
    expect(after.eye.x - after.focus.x).toBeCloseTo(-(before.eye.x - before.focus.x));
    expect(after.eye.z - after.focus.z).toBeCloseTo(-(before.eye.z - before.focus.z));
    expect(after.eye.y).toBeCloseTo(before.eye.y);
  });
});

describe("camera height", () => {
  it("looks at the ground under the focus point when not following anything", () => {
    const rig = createCameraRig({ groundHeightAt: (x, z) => x + 2 * z });
    rig.setFollowEnabled(false);
    rig.pan(3, 4);
    const { focus } = rig.view();
    expect(focus.y).toBeCloseTo(focus.x + 2 * focus.z);
  });
});

describe("camera panning", () => {
  it("moves forward in the direction the camera faces, whatever its rotation", () => {
    const rig = createCameraRig();
    rig.rotate(degrees(70));
    const before = rig.view();
    const facingX = before.focus.x - before.eye.x;
    const facingZ = before.focus.z - before.eye.z;
    const facingLength = Math.hypot(facingX, facingZ);

    rig.pan(0, 10);

    const after = rig.view();
    expect(after.focus.x - before.focus.x).toBeCloseTo((10 * facingX) / facingLength);
    expect(after.focus.z - before.focus.z).toBeCloseTo((10 * facingZ) / facingLength);
  });

  it("moves right at a right angle to the way the camera faces", () => {
    const rig = createCameraRig();
    rig.rotate(degrees(200));
    const before = rig.view();
    rig.pan(10, 0);
    const after = rig.view();
    const movedX = after.focus.x - before.focus.x;
    const movedZ = after.focus.z - before.focus.z;
    expect(Math.hypot(movedX, movedZ)).toBeCloseTo(10);
    // In a y-up world, movement × facing points up when the movement is to the right.
    // Example: facing -z, right is +x, and (+x) × (-z) = +y.
    const facingX = before.focus.x - before.eye.x;
    const facingZ = before.focus.z - before.eye.z;
    expect(movedX * facingX + movedZ * facingZ).toBeCloseTo(0);
    expect(movedZ * facingX - movedX * facingZ).toBeGreaterThan(0);
  });
});

describe("camera zoom", () => {
  it("never zooms closer than 8 m from the point it looks at", () => {
    const rig = createCameraRig();
    rig.zoomBy(0.0001);
    expect(rig.distance).toBeCloseTo(8);
  });

  it("never zooms further than 400 m from the point it looks at", () => {
    const rig = createCameraRig();
    rig.zoomBy(10_000);
    expect(rig.distance).toBeCloseTo(400);
  });

  it("zooms by multiplying the distance, so each step feels the same near and far", () => {
    const rig = createCameraRig();
    rig.zoomBy(0.0001);
    rig.zoomBy(2);
    expect(rig.distance).toBeCloseTo(16);
  });
});

describe("camera follow", () => {
  it("is on by default and keeps looking at the follow target as it moves", () => {
    const rig = createCameraRig();
    const target = { x: 5, y: 2, z: -3 };
    rig.setFollowTarget(target);
    expect(rig.followEnabled).toBe(true);
    expect(rig.view().focus).toEqual({ x: 5, y: 2, z: -3 });

    target.x = 9;
    expect(rig.view().focus).toEqual({ x: 9, y: 2, z: -3 });
  });

  it("stays where it is when follow is off and the target moves", () => {
    const rig = createCameraRig();
    const target = { x: 5, y: 2, z: -3 };
    rig.setFollowTarget(target);
    rig.setFollowEnabled(false);
    expect(rig.view().focus).toMatchObject({ x: 5, z: -3 });

    target.x = 9;
    expect(rig.view().focus).toMatchObject({ x: 5, z: -3 });
  });

  it("keeps a dragged pan offset while following, until snapped back to the target", () => {
    const rig = createCameraRig();
    const target = { x: 0, y: 0, z: 0 };
    rig.setFollowTarget(target);
    rig.pan(3, 4);
    const offset = rig.view().focus;
    expect(Math.hypot(offset.x, offset.z)).toBeCloseTo(5);

    target.x = 10;
    expect(rig.view().focus.x).toBeCloseTo(10 + offset.x);
    expect(rig.view().focus.z).toBeCloseTo(offset.z);

    rig.snapToFollowTarget();
    expect(rig.view().focus).toEqual({ x: 10, y: 0, z: 0 });
  });

  it("moves the view back to the target when snapped with follow off, and stays there", () => {
    const rig = createCameraRig();
    const target = { x: 5, y: 2, z: -3 };
    rig.setFollowTarget(target);
    rig.setFollowEnabled(false);
    rig.panWhenFree(40, 40);
    target.x = 9;

    rig.snapToFollowTarget();
    expect(rig.view().focus).toMatchObject({ x: 9, z: -3 });
    expect(rig.followEnabled).toBe(false);

    target.x = 20;
    expect(rig.view().focus).toMatchObject({ x: 9, z: -3 });
  });

  it("ignores keyboard and screen-edge panning while following", () => {
    const rig = createCameraRig();
    rig.panWhenFree(10, 10);
    expect(rig.view().focus).toEqual({ x: 0, y: 0, z: 0 });

    rig.setFollowEnabled(false);
    rig.panWhenFree(3, 4);
    const focus = rig.view().focus;
    expect(Math.hypot(focus.x, focus.z)).toBeCloseTo(5);
  });
});

describe("camera pan limit", () => {
  it("stops the free focus at the edge of the valley, and pans back from there at once", () => {
    const rig = createCameraRig({ focusLimit: 150 });
    rig.setFollowEnabled(false);
    rig.rotate(-Math.PI / 4);
    // The camera now faces north, towards z = -150.
    rig.pan(0, 1000);
    expect(rig.view().focus.z).toBeCloseTo(-150);
    rig.pan(0, -10);
    expect(rig.view().focus.z).toBeCloseTo(-140);
  });

  it("stops a dragged offset while following where the focus reaches the edge", () => {
    const rig = createCameraRig({ focusLimit: 150 });
    rig.setFollowTarget({ x: 140, y: 0, z: 0 });
    rig.rotate(-Math.PI / 4);
    // Right is east, towards x = 150.
    rig.pan(500, 0);
    expect(rig.view().focus.x).toBeCloseTo(150);
    rig.pan(-5, 0);
    expect(rig.view().focus.x).toBeCloseTo(145);
  });

  it("keeps the eye above the ground under it", () => {
    const rig = createCameraRig({ groundHeightAt: (x) => (x > 20 ? 100 : 0) });
    rig.setFollowEnabled(false);
    rig.rotate(Math.PI / 4);
    // The eye now sits east of the focus, over the high ground.
    const { eye } = rig.view();
    expect(eye.x).toBeGreaterThan(20);
    expect(eye.y).toBeGreaterThanOrEqual(102);
  });
});

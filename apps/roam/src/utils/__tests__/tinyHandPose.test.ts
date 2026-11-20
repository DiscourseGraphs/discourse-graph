import { describe, expect, it } from "vitest";
import {
  getTinyHandPose,
  IMAGE_ROTATION,
  LAVENDER,
  WRIST_DISTANCE,
} from "~/components/canvas/tinyHand/tinyHandPose";

const stage = { width: 1000, height: 500 };
const aim = { x: 300, y: 240, pressed: false };

describe("TinyHand arm", () => {
  it("puts the calibrated wrist on the rod and extends the rod below the canvas", () => {
    const dx = LAVENDER.wristX - LAVENDER.tipX;
    const dy = LAVENDER.wristY - LAVENDER.tipY;
    const rotation = (IMAGE_ROTATION * Math.PI) / 180;
    expect(dx * Math.cos(rotation) - dy * Math.sin(rotation)).toBeCloseTo(0);
    expect(dx * Math.sin(rotation) + dy * Math.cos(rotation)).toBeCloseTo(
      WRIST_DISTANCE,
    );

    const pose = getTinyHandPose({ ...stage, aim, elapsedMs: 0 });
    const angle = (pose.angle * Math.PI) / 180;
    const reach = pose.rodEnd * pose.scale;
    expect(aim.x - reach * Math.sin(angle)).toBeCloseTo(pose.gripX);
    expect(aim.y + reach * Math.cos(angle)).toBeCloseTo(800);
  });

  it("squashes immediately on contact, holds the pose and relaxes after release", () => {
    const rest = getTinyHandPose({ ...stage, aim, elapsedMs: 0 });
    const down = { ...aim, pressed: true };
    const contact = getTinyHandPose({
      ...stage,
      aim: down,
      elapsedMs: 0,
      previous: rest,
    });
    expect(contact.scale).toBeCloseTo(rest.scale * 0.94);
    expect(contact.shadow).not.toBe(rest.shadow);
    expect(
      getTinyHandPose({
        ...stage,
        aim: down,
        elapsedMs: 600,
        previous: contact,
      }),
    ).toEqual(contact);
    const released = getTinyHandPose({
      ...stage,
      aim,
      elapsedMs: 16,
      previous: contact,
    });
    expect(released.scale).toBeGreaterThan(contact.scale);
    expect(released.scale).toBeLessThan(rest.scale);
    expect(
      getTinyHandPose({ ...stage, aim, elapsedMs: 600, previous: released }),
    ).toEqual(rest);
  });

  it("pivots while the grip catches up at the same rate on different displays", () => {
    const first = getTinyHandPose({ ...stage, aim, elapsedMs: 0 });
    const newAim = { ...aim, x: 710, y: 40 };
    const next = { ...stage, aim: newAim };
    const singleFrame = getTinyHandPose({
      ...next,
      elapsedMs: 32,
      previous: first,
    });
    const halfFrame = getTinyHandPose({
      ...next,
      elapsedMs: 16,
      previous: first,
    });
    const twoFrames = getTinyHandPose({
      ...next,
      elapsedMs: 16,
      previous: halfFrame,
    });
    expect(singleFrame.gripX).toBeCloseTo(twoFrames.gripX);
    expect(singleFrame.gripX).toBeGreaterThan(first.gripX);
    expect(singleFrame.gripX).toBeLessThan(newAim.x + 0.18 * stage.width);
    expect(singleFrame.angle).not.toBeCloseTo(first.angle);
  });

  it("keeps the original web demo scale limits when the canvas resizes", () => {
    for (const [height, handHeight] of [
      [200, 64],
      [500, 95],
      [1200, 124],
    ]) {
      const pose = getTinyHandPose({ ...stage, height, aim, elapsedMs: 0 });
      expect(pose.scale * LAVENDER.height).toBeCloseTo(handHeight);
    }
  });
});

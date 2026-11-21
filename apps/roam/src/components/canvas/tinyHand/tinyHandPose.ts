// Image coordinates and grip geometry from nilbuild/tinyhand @ da98f98, docs/pointer.js.
export const LAVENDER = {
  width: 257,
  height: 380,
  tipX: 95.3,
  tipY: 12,
  wristX: 127.8,
  wristY: 368.6,
};

const wristX = LAVENDER.wristX - LAVENDER.tipX;
const wristY = LAVENDER.wristY - LAVENDER.tipY;
export const WRIST_DISTANCE = Math.hypot(wristX, wristY);
export const IMAGE_ROTATION = (Math.atan2(wristX, wristY) * 180) / Math.PI;

type Aim = { x: number; y: number; pressed: boolean };
type Motion = { gripX: number; pressure: number };
type Pose = Motion & {
  scale: number;
  angle: number;
  rodEnd: number;
  shadow: string;
  settling: boolean;
};

export const getTinyHandPose = ({
  aim,
  width,
  height,
  elapsedMs,
  previous,
}: {
  aim: Aim;
  width: number;
  height: number;
  elapsedMs: number;
  previous?: Motion;
}): Pose => {
  const targetX = Math.min(
    Math.max(aim.x + 0.18 * width, 0.15 * width),
    1.05 * width,
  );
  const gripOffset =
    ((previous?.gripX ?? targetX) - targetX) * Math.exp(-elapsedMs * 0.0096);
  const gripX = targetX + (Math.abs(gripOffset) > 0.3 ? gripOffset : 0);
  const release = (previous?.pressure ?? 0) * Math.exp(-elapsedMs * 0.022);
  const pressure = aim.pressed ? 1 : release > 0.002 ? release : 0;
  const gripY = height + Math.max(height * 0.35, width * 0.3);
  const dx = gripX - aim.x;
  const dy = gripY - aim.y;
  const handHeight = Math.min(124, Math.max(64, height * 0.19));
  const scale = (handHeight * (1 - 0.06 * pressure)) / LAVENDER.height;
  const lift = height * 0.06 * (1 - 0.8 * pressure);
  const blur = Math.max(1, lift * 0.35) + 5 * pressure;
  return {
    gripX,
    pressure,
    scale,
    angle: (-Math.atan2(dx, dy) * 180) / Math.PI,
    rodEnd: Math.hypot(dx, dy) / scale,
    shadow: `drop-shadow(${lift * 0.6}px ${lift}px ${blur}px rgba(0, 0, 0, ${0.26 + 0.02 * pressure}))`,
    settling: gripX !== targetX || (!aim.pressed && pressure > 0),
  };
};

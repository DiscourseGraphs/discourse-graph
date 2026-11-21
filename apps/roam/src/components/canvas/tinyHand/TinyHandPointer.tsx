import React, { useId, useLayoutEffect, useRef } from "react";
import lavender from "./lavender.png";
import {
  getTinyHandPose,
  IMAGE_ROTATION,
  LAVENDER,
  WRIST_DISTANCE,
} from "./tinyHandPose";

type Aim = { x: number; y: number; pressed: boolean };

export const TinyHandPointer = ({ x, y, pressed }: Aim): JSX.Element => {
  const gradientId = useId();
  const shadow = useRef<SVGGElement>(null);
  const arm = useRef<SVGGElement>(null);
  const rod = useRef<SVGLineElement>(null);
  const aim = useRef<Aim>({ x, y, pressed });
  const redraw = useRef<() => void>();

  useLayoutEffect(() => {
    const group = arm.current;
    const line = rod.current;
    const outer = shadow.current;
    const stage = group?.ownerSVGElement;
    if (!group || !line || !outer || !stage) return;

    let width = stage.clientWidth;
    let height = stage.clientHeight;
    let previous: ReturnType<typeof getTinyHandPose> | undefined;
    let frame: number | undefined;
    let last = performance.now();
    const draw = (now: number): void => {
      frame = undefined;
      const pointer = aim.current;
      const pose = getTinyHandPose({
        aim: pointer,
        width,
        height,
        elapsedMs: Math.max(0, now - last),
        previous,
      });
      last = now;
      previous = pose;
      group.setAttribute(
        "transform",
        `translate(${pointer.x} ${pointer.y}) rotate(${pose.angle}) scale(${pose.scale})`,
      );
      line.setAttribute("y2", String(pose.rodEnd));
      // Keep the cast shadow in screen space while the arm pivots underneath it.
      outer.style.filter = pose.shadow;
      if (pose.settling) frame = requestAnimationFrame(draw);
    };
    const wake = (): void => {
      const now = performance.now();
      if (frame === undefined) last = now;
      else cancelAnimationFrame(frame);
      draw(now);
    };
    redraw.current = wake;
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      wake();
    });
    observer.observe(stage);
    return () => {
      redraw.current = undefined;
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    aim.current = { x, y, pressed };
    redraw.current?.();
  }, [x, y, pressed]);

  return (
    <g ref={shadow} className="dg-tiny-hand-pointer">
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="-13.3"
          x2="13.3"
          y1="0"
          y2="0"
        >
          <stop stopColor="#000" />
          <stop offset="35%" stopColor="#121214" />
          <stop offset="55%" stopColor="#3a3a3e" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
      </defs>
      <g ref={arm}>
        <line
          ref={rod}
          x1={0}
          x2={0}
          y1={WRIST_DISTANCE}
          stroke={`url(#${gradientId})`}
          strokeWidth={26.6}
          strokeLinecap="round"
        />
        <image
          href={lavender}
          width={LAVENDER.width}
          height={LAVENDER.height}
          transform={`rotate(${IMAGE_ROTATION}) translate(${-LAVENDER.tipX} ${-LAVENDER.tipY})`}
        />
      </g>
    </g>
  );
};

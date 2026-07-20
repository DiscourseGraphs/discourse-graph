"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

const CanvasRoom = dynamic(
  () => import("./CanvasRoom").then((module) => module.CanvasRoom),
  {
    loading: () => (
      <main className="grid h-dvh place-items-center bg-slate-100 text-sm font-medium text-slate-500">
        Opening canvas...
      </main>
    ),
    ssr: false,
  },
);

export const CanvasRoomLoader = ({
  roomId,
}: {
  roomId: string;
}): ReactElement => <CanvasRoom roomId={roomId} />;

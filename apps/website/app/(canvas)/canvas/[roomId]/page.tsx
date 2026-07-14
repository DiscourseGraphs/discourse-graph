import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { CanvasRoomLoader } from "../components/CanvasRoomLoader";

type CanvasPageProps = {
  params: Promise<{ roomId: string }>;
};

const ROOM_ID_PATTERN = /^[0-9a-f-]{36}$/i;

const CanvasPage = async ({
  params,
}: CanvasPageProps): Promise<ReactElement> => {
  const { roomId } = await params;
  if (!ROOM_ID_PATTERN.test(roomId)) notFound();

  return <CanvasRoomLoader roomId={roomId} />;
};

export default CanvasPage;

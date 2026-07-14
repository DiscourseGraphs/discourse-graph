import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

const NewCanvasPage = (): never => {
  redirect(`/canvas/${randomUUID()}`);
};

export default NewCanvasPage;

const IS_DEV = process.env.NODE_ENV !== "production";

export const nextApiRoot = (): string => {
  if (
    process.env.NEXT_API_ROOT !== undefined &&
    process.env.NEXT_API_ROOT !== ""
  )
    return process.env.NEXT_API_ROOT;
  return IS_DEV
    ? "http://localhost:3000/api"
    : "https://discoursegraphs.com/api";
};

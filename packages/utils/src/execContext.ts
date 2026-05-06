const IS_DEV = process.env.NODE_ENV !== "production";

export const nextRoot = (): string => {
  if (
    process.env.NEXT_API_ROOT !== undefined &&
    process.env.NEXT_API_ROOT !== ""
  )
    return process.env.NEXT_API_ROOT.split("/").slice(0, 3).join("");
  return IS_DEV ? "http://localhost:3000/" : "https://discoursegraphs.com/";
};

export const nextApiRoot = (): string => {
  if (
    process.env.NEXT_API_ROOT !== undefined &&
    process.env.NEXT_API_ROOT !== ""
  )
    return process.env.NEXT_API_ROOT;
  return nextRoot() + "api";
};

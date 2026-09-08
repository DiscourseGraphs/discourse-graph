import { type json, getRawBlockProps, normalizeProps } from "./getBlockProps";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

export const deNormalizeProps = (props: json): json =>
  typeof props === "object"
    ? props === null
      ? null
      : Array.isArray(props)
        ? props.map(deNormalizeProps)
        : Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              `:${k}`,
              typeof v === "object" && v !== null && !Array.isArray(v)
                ? deNormalizeProps(v)
                : Array.isArray(v)
                  ? v.map(deNormalizeProps)
                  : v,
            ]),
          )
    : props;

// Tracked so a caller about to read a value it just wrote can wait for the update.
const inFlightWrites = new Set<Promise<unknown>>();

export const trackRoamWrite = <T>(write: Promise<T>): Promise<T> => {
  inFlightWrites.add(write);
  void write.catch(() => undefined).finally(() => inFlightWrites.delete(write));
  return write;
};

/** Bounded: a commit may start one further write (the legacy mirror), never a chain. */
export const settleTrackedRoamWrites = async (): Promise<void> => {
  for (let pass = 0; pass < 5 && inFlightWrites.size > 0; pass++) {
    await Promise.allSettled(Array.from(inFlightWrites));
  }
};

export const setBlockPropsAsync = (
  uid: string,
  newProps: Record<string, json>,
  denormalize: boolean = false,
): Promise<json> => {
  const rawBaseProps = getRawBlockProps(uid);
  const baseProps = denormalize ? rawBaseProps : normalizeProps(rawBaseProps);
  if (typeof baseProps === "object" && !Array.isArray(baseProps)) {
    const props = {
      ...(baseProps || {}),
      ...(denormalize
        ? (deNormalizeProps(newProps) as Record<string, json>)
        : newProps),
    } as Record<string, json>;
    return trackRoamWrite(
      window.roamAlphaAPI.data.block
        .update({ block: { uid, props } })
        .then(() => props),
    );
  }
  return Promise.resolve(baseProps);
};

const setBlockProps = (
  uid: string,
  newProps: Record<string, json>,
  denormalize: boolean = false,
): void => {
  void setBlockPropsAsync(uid, newProps, denormalize);
};

export const testSetBlockProps = (
  title: string,
  newProps: Record<string, json>,
) => {
  const uid = getPageUidByPageTitle(title);
  return uid ? setBlockPropsAsync(uid, newProps) : null;
};

export default setBlockProps;

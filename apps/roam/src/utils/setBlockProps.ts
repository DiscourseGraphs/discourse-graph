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

// Roam applies a block update asynchronously, and almost every caller here is
// fire-and-forget. A caller that is about to *read* a value it just wrote needs
// to know when the write landed, so every in-flight update is tracked here.
const inFlightWrites = new Set<Promise<json>>();

const track = (write: Promise<json>): Promise<json> => {
  inFlightWrites.add(write);
  void write.catch(() => undefined).finally(() => inFlightWrites.delete(write));
  return write;
};

/**
 * Resolves once every block-prop write started so far has been applied. Bounded
 * rather than looped to exhaustion: a commit can start one further write (the
 * legacy block mirror), not an endless chain, so a runaway cannot hang a caller.
 */
export const settleBlockPropWrites = async (): Promise<void> => {
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
    return track(
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

export type json =
  | string
  | number
  | boolean
  | null
  | json[]
  | { [key: string]: json };

/**
 * Whether a props value is a plain JSON object, and so safe to spread or index.
 *
 * Roam hands back whatever was written, so every step into a props tree has to be
 * narrowed. `undefined` is accepted because a caller reading an absent key gets it under
 * `noUncheckedIndexedAccess`, and treating it as "not an object" is the same answer.
 */
export const isJsonObject = (
  value: json | undefined,
): value is Record<string, json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeProps = (props: json): json =>
  typeof props === "object"
    ? props === null
      ? null
      : Array.isArray(props)
        ? props.map(normalizeProps)
        : Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k.replace(/^:+/, ""),
              typeof v === "object" && v !== null && !Array.isArray(v)
                ? normalizeProps(v)
                : Array.isArray(v)
                  ? v.map(normalizeProps)
                  : v,
            ]),
          )
    : props;

export const getRawBlockProps = (uid: string) =>
  (window.roamAlphaAPI.pull("[:block/props]", [":block/uid", uid])?.[
    ":block/props"
  ] || {}) as Record<string, json>;

const getBlockProps = (uid: string) =>
  normalizeProps(getRawBlockProps(uid)) as Record<string, json>;

export default getBlockProps;

export type json =
  | string
  | number
  | boolean
  | null
  | json[]
  | { [key: string]: json };

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

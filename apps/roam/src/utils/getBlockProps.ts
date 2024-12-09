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

const getBlockProps = (uid: string) =>
  normalizeProps(
    (window.roamAlphaAPI.pull("[:block/props]", [":block/uid", uid])?.[
      ":block/props"
    ] || {}) as Record<string, json>,
  ) as Record<string, json>;

export default getBlockProps;

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

const setBlockProps = (
  uid: string,
  newProps: Record<string, json>,
  denormalize: boolean = false,
) => {
  const rawBaseProps = getRawBlockProps(uid);
  const baseProps = denormalize ? rawBaseProps : normalizeProps(rawBaseProps);
  if (typeof baseProps === "object" && !Array.isArray(baseProps)) {
    const props = {
      ...(baseProps || {}),
      ...(denormalize
        ? (deNormalizeProps(newProps) as Record<string, json>)
        : newProps),
    } as Record<string, json>;
    window.roamAlphaAPI.data.block.update({ block: { uid, props } });
    return props;
  }
  return baseProps;
};

export const testSetBlockProps = (
  title: string,
  newProps: Record<string, json>,
) => {
  const uid = getPageUidByPageTitle(title);
  return uid ? setBlockProps(uid, newProps) : null;
};

export default setBlockProps;

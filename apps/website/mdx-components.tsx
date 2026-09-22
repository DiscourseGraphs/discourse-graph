import { NodeTag } from "~/components/docs/NodeTag";
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

type MdxComponentMap = Record<string, unknown>;

export const useMDXComponents = (
  components: MdxComponentMap = {},
): MdxComponentMap => {
  const themeComponents = getThemeComponents();

  return {
    ...themeComponents,
    NodeTag,
    ...components,
  };
};

export default useMDXComponents;

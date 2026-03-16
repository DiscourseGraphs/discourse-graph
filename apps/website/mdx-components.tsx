import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

type MdxComponentMap = Record<string, unknown>;

export const useMDXComponents = (
  components: MdxComponentMap = {},
): MdxComponentMap => ({
  ...getThemeComponents(),
  ...components,
});

export default useMDXComponents;

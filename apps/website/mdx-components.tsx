import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

type MdxComponentMap = Record<string, unknown>;
type ImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

const parseAltSize = (alt?: string): { alt: string; width?: number } => {
  if (!alt) return { alt: "" };
  const match = alt.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
  if (match) return { alt: match[1].trim(), width: parseInt(match[2], 10) };
  return { alt };
};

export const useMDXComponents = (
  components: MdxComponentMap = {},
): MdxComponentMap => {
  const themeComponents = getThemeComponents();
  const BaseImg = themeComponents.img as
    | React.ComponentType<ImgProps>
    | undefined;

  const DocImage = ({ alt, width, ...props }: ImgProps) => {
    const { alt: cleanAlt, width: parsedWidth } = parseAltSize(alt);
    const resolvedWidth = parsedWidth ?? width;
    if (BaseImg) {
      return <BaseImg alt={cleanAlt} width={resolvedWidth} {...props} />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={cleanAlt} width={resolvedWidth} {...props} />;
  };

  return {
    ...themeComponents,
    img: DocImage,
    ...components,
  };
};

export default useMDXComponents;

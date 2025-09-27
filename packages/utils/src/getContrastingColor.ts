import { Colord, colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";

extend([a11yPlugin]);

type ColordWithA11y = Colord & {
  contrast(color2?: Colord | string): number;
};

type ColorScheme = {
  secondary: string;
  primary: string;
  tertiary: string;
};

const getContrastingColor = (primary: Colord): ColorScheme => {
  const isLight = primary.isLight();
  let secondaryColor = primary;

  const primaryWithA11y = primary as ColordWithA11y;
  let secondaryWithA11y = secondaryColor as ColordWithA11y;

  while (secondaryWithA11y.contrast(primaryWithA11y) < 4.5) {
    const previousHex = secondaryColor.toHex();

    secondaryColor = isLight
      ? secondaryColor.darken(0.1)
      : secondaryColor.lighten(0.1);

    if (secondaryColor.toHex() === previousHex) {
      break;
    }

    secondaryWithA11y = secondaryColor as ColordWithA11y;
  }

  const tertiaryColor = isLight ? primary.darken(0.35) : primary.lighten(0.35);

  return {
    secondary: secondaryColor.toHex(),
    primary: primary.toHex(),
    tertiary: tertiaryColor.toHex(),
  };
};

export default getContrastingColor;

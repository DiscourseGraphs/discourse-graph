// We want each package to be responsible for its own content.
import type { Config } from "tailwindcss";

const config: Omit<Config, "content"> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF8C4B",

          rgb: "255, 140, 75",
        },
        secondary: {
          DEFAULT: "#5F57C0",

          rgb: "95, 87, 192",
        },
        neutral: {
          dark: "#1F1F1F",
          light: "#F1F1F1",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

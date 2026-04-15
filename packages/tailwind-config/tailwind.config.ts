// We want each package to be responsible for its own content.
import type { Config } from "tailwindcss";

const config: Omit<Config, "content"> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#FF8C4B",
          foreground: "hsl(var(--primary-foreground))",
          rgb: "255, 140, 75",
        },
        secondary: {
          DEFAULT: "#5F57C0",
          foreground: "hsl(var(--secondary-foreground))",
          rgb: "95, 87, 192",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
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

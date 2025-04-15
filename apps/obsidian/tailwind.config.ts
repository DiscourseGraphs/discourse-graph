import type { Config } from "tailwindcss";

const config: Pick<Config, "content" | "theme" | "plugins"> = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Map Obsidian CSS variables to Tailwind classes
      colors: {
        // Background colors
        primary: "var(--background-primary)",
        secondary: "var(--background-secondary)",
        tertiary: "var(--background-tertiary)",

        // Text colors
        normal: "var(--text-normal)",
        muted: "var(--text-muted)",
        "accent-text": "var(--text-accent)",
        error: "var(--text-error)",
        "on-accent": "var(--text-on-accent)",

        // Interactive elements
        accent: {
          DEFAULT: "var(--interactive-accent)",
          hover: "var(--interactive-accent-hover)",
        },

        // Modifiers
        "modifier-border": "var(--background-modifier-border)",
        "modifier-form-field": "var(--background-modifier-form-field)",
        "modifier-error": "var(--background-modifier-error)",
        "modifier-hover": "var(--background-modifier-hover)",
      },
      borderColor: {
        DEFAULT: "var(--background-modifier-border)",
      },
    },
  },
};

export default config;

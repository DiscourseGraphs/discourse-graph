import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;

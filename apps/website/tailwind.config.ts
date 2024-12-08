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
          DEFAULT: "#073CD6",
          rgb: "7, 60, 214",
        },
        secondary: {
          DEFAULT: "#DCE4FF",
          rgb: "220, 228, 255",
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

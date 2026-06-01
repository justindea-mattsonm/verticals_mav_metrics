import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light theme palette — Justin prefers white backgrounds, dark text.
        background: "#ffffff",
        foreground: "#0f172a",
        muted: "#f8fafc",
        "muted-foreground": "#64748b",
        border: "#e2e8f0",
        accent: "#2563eb",
      },
    },
  },
  plugins: [],
};

export default config;

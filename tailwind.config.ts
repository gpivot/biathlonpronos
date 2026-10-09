import type { Config } from "tailwindcss";

// Tokens repris de la planche d'identité graphique (projet claude.ai "Biathlopronos").
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0f1c",
        bg2: "#0d1526",
        card: "#121d33",
        card2: "#16233d",
        border: "#223252",
        text: "#f4f8ff",
        "text-dim": "#90a3c4",
        ice: "oklch(0.80 0.12 200)",
        "ice-soft": "oklch(0.30 0.06 200)",
        gold: "oklch(0.84 0.15 90)",
        "gold-soft": "oklch(0.30 0.07 90)",
        red: "oklch(0.62 0.20 25)",
        frost: "#eaf6ff",
      },
      fontFamily: {
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
        body: ["var(--font-work-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

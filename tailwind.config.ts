import type { Config } from "tailwindcss";

// Tokens repris de la planche d'identité graphique (projet claude.ai "Biathlopronos").
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Couleurs définies par des variables CSS (src/app/globals.css) pour permettre le thème clair
      // (classe `light` sur <html>) ; `<alpha-value>` garde les modificateurs d'opacité (bg-card/70).
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        bg2: "rgb(var(--c-bg2) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        card2: "rgb(var(--c-card2) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        "text-dim": "rgb(var(--c-text-dim) / <alpha-value>)",
        ice: "oklch(var(--c-ice) / <alpha-value>)",
        "ice-soft": "oklch(var(--c-ice-soft) / <alpha-value>)",
        gold: "oklch(var(--c-gold) / <alpha-value>)",
        "gold-soft": "oklch(var(--c-gold-soft) / <alpha-value>)",
        red: "oklch(var(--c-red) / <alpha-value>)",
        frost: "rgb(var(--c-frost) / <alpha-value>)",
        // Texte posé sur un fond `ice` (sombre en thème sombre, blanc sur l'ocre du thème clair).
        "on-ice": "rgb(var(--c-on-ice) / <alpha-value>)",
        // Fond de la barre de navigation basse (blanche en thème clair, comme VéloPronos).
        nav: "rgb(var(--c-nav) / <alpha-value>)",
        // Turquoise fixe des dégradés de marque (avatar, en-têtes) : ne change pas avec le thème.
        teal: "oklch(0.8 0.12 200 / <alpha-value>)",
        // Bleu vif des accents VéloPronos (dégradé du bouton d'appel à l'action, avec ice).
        blue: "oklch(0.62 0.19 255 / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-poppins)", "system-ui", "sans-serif"],
        body: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * L'appli n'embarque pas le site : elle ouvre www.biathlonpronos.fr dans une vue web native.
 * Chaque mise à jour poussée sur main (déployée par Vercel) arrive donc dans l'appli sans
 * repasser par les stores. Seuls les changements natifs (plugins, icône…) demandent une
 * nouvelle version.
 */
const config: CapacitorConfig = {
  appId: "fr.biathlonpronos.app",
  appName: "Biathlonpronos",
  // Pages locales : seulement l'écran affiché quand le site est injoignable (pas de réseau).
  webDir: "www",
  server: {
    url: "https://www.biathlonpronos.fr/",
    errorPath: "offline.html",
    // Liens vers ces domaines restent dans l'appli ; les autres s'ouvrent dans le navigateur.
    allowNavigation: ["www.biathlonpronos.fr", "biathlonpronos.fr"],
  },
  backgroundColor: "#0a0f1c",
  android: {
    // Le site garde la même apparence que dans Chrome.
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0a0f1c",
      showSpinner: false,
    },
    FirebaseMessaging: {
      // Notification affichée même quand l'appli est ouverte.
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  // Évite un conflit de noms de paquets Swift (doc du plugin @capacitor-firebase/messaging).
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/messaging": { symlink: true },
        },
      },
    },
  },
};

export default config;

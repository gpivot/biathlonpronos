import { Capacitor, registerPlugin } from "@capacitor/core";

interface ClipboardPlugin {
  write(options: { string: string }): Promise<void>;
}

const NativeClipboard = registerPlugin<ClipboardPlugin>("Clipboard");

/**
 * Copie un texte dans le presse-papiers. Dans l'appli mobile, passe par le plugin natif
 * @capacitor/clipboard s'il est installé ; sinon l'API du navigateur, puis l'ancienne méthode
 * (zone de texte cachée + « copier »), qui marche aussi dans les WebView Android / iOS.
 */
export async function copyText(text: string): Promise<boolean> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Clipboard")) {
    try {
      await NativeClipboard.write({ string: text });
      return true;
    } catch {
      // on essaie les méthodes web
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // repli ci-dessous
    }
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

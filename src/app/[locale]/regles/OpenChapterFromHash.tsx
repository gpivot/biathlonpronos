"use client";

import { useEffect } from "react";

/** Ouvre le chapitre replié visé par l'ancre de l'adresse (ex. /regles#lexique depuis une bulle du lexique). */
export function OpenChapterFromHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}

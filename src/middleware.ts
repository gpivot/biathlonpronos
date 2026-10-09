import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Toutes les routes sauf API, callback OAuth, back-office admin (hors
  // [locale], outil interne non traduit), assets Next.js et fichiers statiques.
  matcher: ["/((?!api|auth|admin|_next|_vercel|.*\\..*).*)"],
};

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BottomNavBar } from "@/components/BottomNavBar";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/AdminNav";
import { SimulatedClockBanner } from "@/components/SimulatedClockBanner";
import { AdminFeedbackProvider } from "./_components/AdminFeedback";
import "../globals.css";

export const metadata: Metadata = { title: "Biathlonpronos — Admin" };

// Comme le reste du site : sans viewport-fit=cover, env(safe-area-inset-*) vaut 0 dans l'appli
// iPhone et le haut de l'admin passe sous la barre d'état (flèche retour impossible à toucher).
export const viewport: Viewport = { viewportFit: "cover" };

/**
 * Back-office : réservé aux profils avec is_admin = true. Hors du routing
 * i18n (`middleware.ts`) — outil interne, jamais traduit.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/fr/sign-in");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/fr");

  // Langue du joueur (cookie posé par next-intl) pour la barre du bas et la flèche retour.
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value;
  const locale = routing.locales.find((l) => l === cookieLocale) ?? routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Nav" });
  const labels = { home: t("home"), stages: t("stages"), standings: t("standings"), leagues: t("leagues"), admin: t("admin") };

  return (
    <html lang="fr">
      <body className="bg-bg text-text">
        <SimulatedClockBanner />
        <AdminFeedbackProvider>
          <div className="flex min-h-dvh flex-col">
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-2 sm:px-6">
              <AdminNav homeHref={`/${locale}`} />
              {children}
            </div>
            {/* Barre de navigation du bas gardée dans l'admin, onglet Admin allumé. */}
            <BottomNavBar labels={labels} isAdmin adminActive locale={locale} />
          </div>
        </AdminFeedbackProvider>
      </body>
    </html>
  );
}

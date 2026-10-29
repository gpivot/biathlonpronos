import { redirect } from "@/i18n/navigation";

/**
 * L'onglet « Ma saison » a été fusionné dans le Calendrier (fin octobre 2026) : les anciens liens
 * (favoris, ?etape= de l'accueil) mènent désormais à /courses, avec la même étape dépliée.
 */
export default async function PronosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ etape?: string }>;
}) {
  const { locale } = await params;
  const { etape } = await searchParams;
  redirect({ href: etape ? `/courses?etape=${encodeURIComponent(etape)}` : "/courses", locale });
}

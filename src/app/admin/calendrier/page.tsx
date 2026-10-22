import { redirect } from "next/navigation";

/** Ancien onglet Calendrier, fusionné avec Résultats dans `/admin`. */
export default function AdminCalendarRedirect() {
  redirect("/admin");
}

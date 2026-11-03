import { createAdminClient } from "@/lib/supabase/server";
import { readServiceAccount } from "@/lib/push/fcm";
import { isEmailConfigured } from "@/lib/notifications/email";
import { NotificationForm } from "./NotificationForm";

export const dynamic = "force-dynamic";

/**
 * Nouvelles du jeu : envoi manuel sur l'appli Android / iOS et/ou par e-mail. Les rappels avant
 * course, les résultats et le récap du lundi partent tout seuls (voir docs/notifications.md).
 */
export default async function AdminNotificationsPage() {
  const admin = createAdminClient();
  const [{ count: android }, { count: ios }, { count: newsEmail }] = await Promise.all([
    admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("platform", "android"),
    admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("platform", "ios"),
    admin.from("notification_preferences").select("user_id", { count: "exact", head: true }).eq("news_email", true),
  ]);
  const configured = readServiceAccount() !== null;
  const emailConfigured = isEmailConfigured();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Notifications</h1>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-text-dim">
        <p>
          Envoie une nouvelle du jeu aux téléphones où l&apos;appli est installée et, si tu coches E-mail, aux joueurs
          qui ont accepté les nouvelles par e-mail dans leur profil. Les joueurs qui ont coupé « Nouvelles du jeu » ne
          reçoivent rien. Les rappels avant course, les résultats et le récap du lundi partent tout seuls.
        </p>
        <p>
          Téléphones inscrits : <strong className="text-frost">{android ?? 0}</strong> Android,{" "}
          <strong className="text-frost">{ios ?? 0}</strong> iPhone. Joueurs inscrits aux nouvelles par e-mail :{" "}
          <strong className="text-frost">{newsEmail ?? 0}</strong>.
        </p>
        <p>
          Commence par « Moi seulement » pour vérifier le texte sur ton téléphone. Le lien est une page du site sans la
          langue (ex. <code>/courses</code>) : chaque joueur l&apos;ouvre dans sa langue.
        </p>
      </div>

      {!configured && (
        <div className="rounded-xl border border-gold/50 bg-gold-soft px-4 py-3 text-sm text-gold">
          Firebase n&apos;est pas encore branché : ajoute la variable FIREBASE_SERVICE_ACCOUNT sur Vercel.
        </div>
      )}

      {!emailConfigured && (
        <div className="rounded-xl border border-gold/50 bg-gold-soft px-4 py-3 text-sm text-gold">
          E-mails pas encore branchés : ajoute la variable RESEND_API_KEY sur Vercel.
        </div>
      )}

      <NotificationForm />
    </div>
  );
}

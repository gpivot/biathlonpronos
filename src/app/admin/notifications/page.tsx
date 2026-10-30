import { createAdminClient } from "@/lib/supabase/server";
import { readServiceAccount } from "@/lib/push/fcm";
import { NotificationForm } from "./NotificationForm";

export const dynamic = "force-dynamic";

/** Notifications de l'appli Android / iOS : nombre de téléphones inscrits et envoi manuel. */
export default async function AdminNotificationsPage() {
  const admin = createAdminClient();
  const [{ count: android }, { count: ios }] = await Promise.all([
    admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("platform", "android"),
    admin.from("push_tokens").select("token", { count: "exact", head: true }).eq("platform", "ios"),
  ]);
  const configured = readServiceAccount() !== null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Notifications</h1>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-text-dim">
        <p>
          Envoie une notification aux téléphones où l&apos;appli Biathlonpronos est installée et autorisée à notifier.
          Le site ouvert dans un navigateur ne reçoit rien.
        </p>
        <p>
          Téléphones inscrits : <strong className="text-frost">{android ?? 0}</strong> Android,{" "}
          <strong className="text-frost">{ios ?? 0}</strong> iPhone.
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

      <NotificationForm />
    </div>
  );
}

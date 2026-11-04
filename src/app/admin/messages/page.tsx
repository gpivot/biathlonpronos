import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import type { SupportMessage } from "@/lib/supportMessages";

export const dynamic = "force-dynamic";

/** Boîte de réception « Suggérer une modification » : une ligne par joueur, non lus en premier. */
export default async function AdminMessagesPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("support_messages")
    .select("id, user_id, from_admin, body, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  const messages = (data ?? []) as SupportMessage[];

  const threads = new Map<string, { last: SupportMessage; unread: number }>();
  for (const m of messages) {
    const thread = threads.get(m.user_id) ?? { last: m, unread: 0 };
    if (!m.from_admin && !m.read_at) thread.unread += 1;
    threads.set(m.user_id, thread);
  }
  const ids = Array.from(threads.keys());
  const { data: profiles } = ids.length ? await admin.from("profiles").select("id, pseudo").in("id", ids) : { data: [] };
  const pseudoById = new Map((profiles ?? []).map((p) => [p.id, p.pseudo as string]));

  const rows = Array.from(threads.entries()).sort(
    ([, a], [, b]) => Number(b.unread > 0) - Number(a.unread > 0) || b.last.created_at.localeCompare(a.last.created_at)
  );
  const format = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Messages des joueurs</h1>
        <p className="text-sm text-text-dim">
          Écrits depuis Profil &gt; Suggérer une modification. Ta réponse s&apos;affiche dans l&apos;appli du joueur, avec une
          notification sur son téléphone.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-text-dim">Aucun message pour l&apos;instant.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(([userId, { last, unread }]) => (
            <li key={userId}>
              <Link
                href={`/admin/messages/${userId}`}
                className={`flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:border-ice ${unread ? "border-ice/60" : "border-border"}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold">{pseudoById.get(userId) ?? "Joueur supprimé"}</span>
                    {unread > 0 && (
                      <span className="rounded-full bg-ice px-2 py-0.5 text-[11px] font-bold text-on-ice">
                        {unread} non lu{unread > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-[13px] text-text-dim">
                    {last.from_admin ? "Toi : " : ""}
                    {last.body}
                  </span>
                </div>
                <span className="flex-shrink-0 text-[12px] text-text-dim">{format.format(new Date(last.created_at))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

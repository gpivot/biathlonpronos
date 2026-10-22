import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PlayerList, type PlayerRow } from "./PlayerList";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage({ searchParams }: { searchParams: { q?: string } }) {
  const admin = createAdminClient();
  const {
    data: { user: me },
  } = await createClient().auth.getUser();

  // L'email n'est pas dans `profiles` : il vient des comptes Supabase Auth (clé service_role).
  const [{ data: profiles }, { data: authData }] = await Promise.all([
    admin.from("profiles").select("id, pseudo, is_admin, created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const players: PlayerRow[] = (profiles ?? [])
    .map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
      email: emailById.get(p.id) ?? "",
      isAdmin: p.is_admin,
      createdAt: p.created_at,
    }))
    .filter((p) => !q || p.pseudo.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    // Admins d'abord, puis ordre alphabétique des pseudos.
    .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.pseudo.localeCompare(b.pseudo, "fr"));

  const adminCount = (profiles ?? []).filter((p) => p.is_admin).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Joueurs & rôles</h1>
        <p className="text-sm text-text-dim">
          {profiles?.length ?? 0} joueurs inscrits, dont {adminCount} admin{adminCount > 1 ? "s" : ""}. Un admin a
          accès à tout le back-office.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Rechercher un pseudo ou un email"
          className="min-w-0 flex-1 rounded border border-border bg-bg px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border border-border px-4 py-2 text-sm font-semibold">
          Rechercher
        </button>
      </form>

      <PlayerList players={players} meId={me?.id ?? null} />
    </div>
  );
}

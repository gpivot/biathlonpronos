import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const admin = createAdminClient();
  const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Import des cotes</h1>
        <p className="text-sm text-text-dim">
          Aucune saison active. <Link href="/admin/seasons" className="underline">Active une saison</Link> avant
          d'importer des cotes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Import des cotes — {season.label}</h1>
      <p className="text-sm text-text-dim">
        Importe tes 3 fichiers CSV (femmes, hommes, relais mixtes). Les athlètes absents sont créés
        automatiquement ; les athlètes déjà présents (même nom + prénom + nation) voient leurs
        cotes mises à jour. Réexécutable sans dupliquer.
      </p>
      <ImportForm seasonId={season.id} />
    </div>
  );
}

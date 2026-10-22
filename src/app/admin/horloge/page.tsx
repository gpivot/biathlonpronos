import { createAdminClient } from "@/lib/supabase/server";
import { getClock } from "@/lib/clock";
import { ClockForm, type ClockRaceOption } from "./ClockForm";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  sprint: "Sprint",
  poursuite: "Poursuite",
  individuel: "Individuel",
  mass_start: "Mass Start",
  relais_h: "Relais Hommes",
  relais_f: "Relais Femmes",
  relais_mixte: "Relais Mixte",
  relais_mixte_simple: "Relais Mixte Simple",
};

export default async function AdminClockPage() {
  const admin = createAdminClient();
  const { now, simulated } = await getClock();

  const { data: season } = await admin.from("seasons").select("id").eq("status", "active").maybeSingle();
  const { data: races } = season
    ? await admin
        .from("races")
        .select("id, format, sex, locks_at, stages!inner(location, season_id)")
        .eq("stages.season_id", season.id)
        .order("locks_at", { ascending: true })
    : { data: [] };

  const raceOptions: ClockRaceOption[] = (races ?? []).map((race: any) => ({
    id: race.id,
    locksAt: race.locks_at,
    label: `${race.stages?.location ?? "?"} — ${FORMAT_LABELS[race.format] ?? race.format}${
      race.sex ? ` ${race.sex === "F" ? "Femmes" : "Hommes"}` : ""
    }`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Horloge simulée</h1>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-text-dim">
        <p>
          Fait comme si on était à une autre date et heure, pour voir l&apos;app telle qu&apos;elle sera à ce moment-là
          (pronos ouverts ou verrouillés, « En ce moment », « Prochainement », statut des courses, globes). La pendule
          continue d&apos;avancer à partir de l&apos;instant choisi.
        </p>
        <p>
          Ça ne change l&apos;affichage <strong className="text-frost">que pour toi, sur ce navigateur</strong> : les
          autres joueurs restent sur l&apos;heure réelle.
        </p>
        <p>
          Limites : la base de données reste sur l&apos;heure réelle. Un prono enregistré pendant la simulation est un
          vrai prono (accepté seulement si la course n&apos;est pas réellement verrouillée), et des résultats saisis
          dans le back-office sont de vrais résultats qui donnent des points à tout le monde.
        </p>
      </div>

      <ClockForm simulated={simulated} nowIso={now.toISOString()} races={raceOptions} />
    </div>
  );
}

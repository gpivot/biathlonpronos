import { normalizeLabel, toCsv } from "./csv";
import { ATHLETE_RESULTS_HEADERS, NATION_RESULTS_HEADERS } from "./resultsCsv";
import { fuseeGachetteEligibility } from "../scoring/fuseeGachette";

/**
 * Résultats officiels lus dans le datacenter de l'IBU (biathlonresults.com, API JSON publique
 * utilisée par leur propre site). Le résultat est converti au format du CSV de résultats, pour
 * passer par le même chemin que l'import : le tableau est pré-rempli, l'admin relit et valide.
 */
const IBU_API = "https://biathlonresults.com/modules/sportapi/api";

export interface IbuEvent {
  EventId: string;
  StartDate: string;
  EndDate: string;
  Organizer?: string;
  ShortDescription?: string;
}

export interface IbuCompetition {
  RaceId: string;
  StartTime: string;
  catId?: string; // SW (femmes), SM (hommes), MX (mixte)
  DisciplineId?: string; // SP, PU, IN, MS, RL, SR
  ShortDescription?: string;
}

export interface IbuResultRow {
  Rank?: string | number | null;
  IRM?: string | null;
  IsTeam?: boolean;
  Leg?: number | null;
  Nat?: string;
  FamilyName?: string;
  GivenName?: string;
  Name?: string;
  Behind?: string | null;
  ShootingTotal?: string | number | null;
  IBUId?: string;
}

/** Saison « 2026-27 » → identifiant IBU « 2627 ». */
export function ibuSeasonId(label: string): string | null {
  const m = label.match(/(\d{2})(\d{2})\D+(\d{2,4})/);
  if (!m) return null;
  return `${m[2]}${m[3].slice(-2)}`;
}

/**
 * Saison IBU d'après la date de l'étape (une saison va de juillet à juin) : « 2025-11-29 » → « 2526 ».
 * Plus fiable que le label, une étape pouvant être rangée dans une autre saison du jeu (tests, reprise
 * d'un calendrier passé).
 */
export function ibuSeasonIdForDate(isoDate: string): string | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const start = Number(m[2]) >= 7 ? Number(m[1]) : Number(m[1]) - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

const DISCIPLINE_BY_FORMAT: Record<string, string> = {
  sprint: "SP",
  poursuite: "PU",
  individuel: "IN",
  mass_start: "MS",
  relais_h: "RL",
  relais_f: "RL",
  relais_mixte: "RL",
  relais_mixte_simple: "SR",
};

function categoryFor(format: string, sex: string | null): string {
  if (format === "relais_mixte" || format === "relais_mixte_simple") return "MX";
  if (format === "relais_f" || sex === "F") return "SW";
  return "SM";
}

const DAY = 24 * 3600 * 1000;

/** Événement IBU qui recouvre les dates de l'étape (le lieu sert à départager). */
export function pickEvent(events: IbuEvent[], stage: { location: string; starts_on: string; ends_on: string }): IbuEvent | null {
  const start = new Date(`${stage.starts_on}T00:00:00Z`).getTime();
  const end = new Date(`${stage.ends_on}T23:59:59Z`).getTime();
  const overlapping = events.filter(
    (e) => new Date(e.StartDate).getTime() <= end + DAY && new Date(e.EndDate).getTime() >= start - DAY
  );
  // L'IBU écrit « Oestersund » : on compare aussi la forme translittérée (ö → oe).
  const locations = [normalizeLabel(stage.location), normalizeLabel(stage.location.toLowerCase().replace(/[äöü]/g, (c) => `${c}e`))];
  return (
    overlapping.find((e) => {
      const label = normalizeLabel(`${e.Organizer ?? ""} ${e.ShortDescription ?? ""}`);
      return locations.some((l) => label.includes(l));
    }) ??
    (overlapping.length === 1 ? overlapping[0] : null)
  );
}

/** Course IBU de même format et même catégorie, la plus proche de l'heure de départ (même jour). */
export function pickCompetition(
  competitions: IbuCompetition[],
  race: { format: string; sex: string | null; locks_at: string }
): IbuCompetition | null {
  const discipline = DISCIPLINE_BY_FORMAT[race.format];
  const category = categoryFor(race.format, race.sex);
  const target = new Date(race.locks_at).getTime();
  const candidates = competitions
    .filter((c) => c.DisciplineId === discipline && c.catId === category)
    .map((c) => ({ c, gap: Math.abs(new Date(c.StartTime).getTime() - target) }))
    .filter(({ gap }) => gap < DAY)
    .sort((a, b) => a.gap - b.gap);
  return candidates[0]?.c ?? null;
}

/**
 * Classement IBU → CSV de résultats. Gâchette = 0 faute au tir ; Fusée = meilleur temps de ski
 * (`fastestSkiIbuId`, lu dans l'analyse « temps de course » quand elle est disponible).
 */
export function ibuResultsToCsv(mode: "athlete" | "nation", rows: IbuResultRow[], fastestSkiIbuId?: string | null): string {
  const ranked = rows.filter((r) => {
    const rank = Number(r.Rank);
    if (!Number.isInteger(rank) || rank < 1 || r.IRM) return false;
    // Relais : seule la ligne de l'équipe compte, pas celles des relayeurs.
    return mode === "nation" ? r.IsTeam !== false && !r.Leg : true;
  });

  if (mode === "nation") {
    return toCsv(NATION_RESULTS_HEADERS, ranked.map((r) => [Number(r.Rank), r.Nat]));
  }
  return toCsv(
    ATHLETE_RESULTS_HEADERS,
    ranked.map((r) => {
      const misses = r.ShootingTotal == null || r.ShootingTotal === "" ? null : Number(r.ShootingTotal);
      return [
        Number(r.Rank),
        r.FamilyName ?? r.Name ?? "",
        r.GivenName ?? "",
        r.Nat,
        Number(r.Rank) === 1 ? "0" : (r.Behind ?? ""),
        "",
        fastestSkiIbuId && r.IBUId === fastestSkiIbuId ? "oui" : "",
        misses === 0 ? "oui" : "",
      ];
    })
  );
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${IBU_API}/${path}`, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`IBU : réponse ${response.status} pour ${path}`);
  return response.json() as Promise<T>;
}

export interface IbuFetchResult {
  raceId: string;
  description: string;
  csv: string;
  warnings: string[];
}

/** Retrouve la course IBU (ou utilise `forcedRaceId`) et renvoie son classement au format CSV. */
export async function fetchIbuResults(params: {
  seasonLabel: string;
  stage: { location: string; starts_on: string; ends_on: string };
  race: { format: string; sex: string | null; locks_at: string };
  mode: "athlete" | "nation";
  forcedRaceId?: string;
}): Promise<IbuFetchResult> {
  const { seasonLabel, stage, race, mode, forcedRaceId } = params;
  const warnings: string[] = [];
  let raceId = forcedRaceId?.trim();
  let description = raceId ?? "";

  if (!raceId) {
    const seasonId = ibuSeasonIdForDate(stage.starts_on) ?? ibuSeasonId(seasonLabel);
    if (!seasonId) throw new Error(`Saison « ${seasonLabel} » : identifiant IBU introuvable.`);
    // Level 1 = Coupe du monde, Championnats du monde et JO compris.
    const events = await getJson<IbuEvent[]>(`Events?SeasonId=${seasonId}&Level=1`);
    const event = pickEvent(events, stage);
    if (!event) throw new Error(`Aucune étape IBU trouvée pour ${stage.location} (${stage.starts_on}).`);

    const competitions = await getJson<IbuCompetition[]>(`Competitions?EventId=${encodeURIComponent(event.EventId)}`);
    const competition = pickCompetition(competitions, race);
    if (!competition) throw new Error(`Course introuvable dans l'étape IBU ${event.EventId} : saisis son identifiant à la main.`);
    raceId = competition.RaceId;
    description = `${event.ShortDescription ?? event.EventId} — ${competition.ShortDescription ?? raceId}`;
  }

  const data = await getJson<{ Results?: IbuResultRow[]; Competition?: { ShortDescription?: string } }>(
    `Results?RaceId=${encodeURIComponent(raceId)}`
  );
  const rows = data.Results ?? [];
  if (rows.length === 0) throw new Error(`Pas encore de résultats publiés par l'IBU pour ${raceId}.`);
  if (forcedRaceId) description = data.Competition?.ShortDescription ?? raceId;

  let fastestSkiIbuId: string | null = null;
  // La Fusée ne compte qu'au sprint et à l'individuel (§15) : inutile de chercher le temps de ski sinon.
  if (mode === "athlete" && fuseeGachetteEligibility(race.format).fusee) {
    try {
      const analysis = await getJson<{ Results?: IbuResultRow[] }>(
        `AnalyticResults?RaceId=${encodeURIComponent(raceId)}&TypeId=CRST`
      );
      fastestSkiIbuId = analysis.Results?.find((r) => Number(r.Rank) === 1)?.IBUId ?? null;
    } catch {
      // Analyse parfois publiée plus tard : on laisse la Fusée à cocher à la main.
    }
    if (!fastestSkiIbuId) warnings.push("Temps de ski indisponible : coche la Fusée à la main.");
  }

  return { raceId, description, csv: ibuResultsToCsv(mode, rows, fastestSkiIbuId), warnings };
}

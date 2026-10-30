import type { SupabaseClient } from "@supabase/supabase-js";
import type { BonusCardEffect } from "./scoring/types";

/**
 * Cartes bonus gagnées au 10/10 (§12-13). Pour l'instant, seules deux cartes se choisissent
 * (demande de Guillaume, octobre 2026) :
 * - « Ça farte » : ×3 sur un biathlète d'une course individuelle ;
 * - « 4e choix » (`balle_de_pioche` en base) : 4 biathlètes au lieu de 3, les 3 meilleurs comptent,
 *   sur 4 courses individuelles : 2 hommes et 2 femmes, à partir de la course où elle est activée.
 * Une seule carte à la fois : pas de Ça farte sur une course couverte par un 4e choix.
 */

export const CLAIMABLE_CARD_TYPES = ["ca_farte", "balle_de_pioche"] as const;
export type ClaimableCardType = (typeof CLAIMABLE_CARD_TYPES)[number];

/** Nombre de courses individuelles couvertes par le 4e choix, par sexe. */
export const QUATRIEME_CHOIX_RACES_PER_SEX = 2;

export interface CardRace {
  id: string;
  format: string;
  sex: string | null;
  locks_at: string;
  status: string;
}

export function isRelayFormat(format: string): boolean {
  return format.startsWith("relais");
}

/**
 * Courses couvertes par un 4e choix activé sur `activationRaceId` : cette course puis les suivantes
 * de la saison (ordre des départs), relais exclus, jusqu'à 2 par sexe. Moins de 4 en fin de saison.
 */
export function quatriemeChoixWindow(activationRaceId: string, seasonRaces: CardRace[]): string[] {
  const activation = seasonRaces.find((r) => r.id === activationRaceId);
  if (!activation || isRelayFormat(activation.format)) return [];
  const start = new Date(activation.locks_at).getTime();
  const countBySex = new Map<string, number>();
  const window: string[] = [];
  const sorted = seasonRaces
    .filter((r) => !isRelayFormat(r.format) && new Date(r.locks_at).getTime() >= start)
    .sort(
      (a, b) =>
        new Date(a.locks_at).getTime() - new Date(b.locks_at).getTime() ||
        (a.id === activationRaceId ? -1 : b.id === activationRaceId ? 1 : 0)
    );
  for (const race of sorted) {
    const sex = race.sex ?? "";
    const count = countBySex.get(sex) ?? 0;
    if (count >= QUATRIEME_CHOIX_RACES_PER_SEX) continue;
    countBySex.set(sex, count + 1);
    window.push(race.id);
  }
  return window;
}

export interface CardRow {
  id: string;
  card_type: string;
  status: string;
  used_on_race_id: string | null;
  earned_at?: string;
}

export type CardState = "available" | "active" | "used";

export interface BonusCardView {
  id: string;
  type: string;
  state: CardState;
  /** 4e choix joué : courses couvertes et nombre d'entre elles déjà parties. */
  windowSize?: number;
  windowStarted?: number;
}

/**
 * État affiché d'une carte : disponible (pas encore jouée), active (jouée, au moins une course
 * couverte pas encore notée), utilisée (grisée, pour mémoire).
 */
export function describeCard(card: CardRow, seasonRaces: CardRace[], now: Date): BonusCardView {
  if (card.status === "available") return { id: card.id, type: card.card_type, state: "available" };
  const raceById = new Map(seasonRaces.map((r) => [r.id, r]));
  const raceIds =
    card.card_type === "balle_de_pioche" && card.used_on_race_id
      ? quatriemeChoixWindow(card.used_on_race_id, seasonRaces)
      : card.used_on_race_id
        ? [card.used_on_race_id]
        : [];
  const races = raceIds.map((id) => raceById.get(id)).filter((r): r is CardRace => !!r);
  const active = races.some((r) => r.status !== "finished");
  const view: BonusCardView = { id: card.id, type: card.card_type, state: active ? "active" : "used" };
  if (card.card_type === "balle_de_pioche") {
    view.windowSize = races.length;
    view.windowStarted = races.filter((r) => new Date(r.locks_at) <= now).length;
  }
  return view;
}

/** Cartes jouées par un joueur qui s'appliquent à une course donnée (moteur de scoring, formulaire). */
export function cardsOnRace(
  raceId: string,
  cards: CardRow[],
  seasonRaces: CardRace[]
): { quatriemeChoix: CardRow | null; caFarte: CardRow | null } {
  let quatriemeChoix: CardRow | null = null;
  let caFarte: CardRow | null = null;
  for (const card of cards) {
    if (card.status !== "used" || !card.used_on_race_id) continue;
    if (card.card_type === "ca_farte" && card.used_on_race_id === raceId) caFarte = card;
    if (card.card_type === "balle_de_pioche" && quatriemeChoixWindow(card.used_on_race_id, seasonRaces).includes(raceId)) {
      quatriemeChoix = card;
    }
  }
  return { quatriemeChoix, caFarte };
}

/** Une carte peut-elle être jouée sur cette course ? (une seule carte à la fois) */
export function canPlayCard(
  type: ClaimableCardType,
  raceId: string,
  cards: CardRow[],
  seasonRaces: CardRace[]
): boolean {
  const race = seasonRaces.find((r) => r.id === raceId);
  if (!race || isRelayFormat(race.format)) return false;
  if (!cards.some((c) => c.card_type === type && c.status === "available")) return false;
  const current = cardsOnRace(raceId, cards, seasonRaces);
  if (current.quatriemeChoix || current.caFarte) return false;
  if (type === "balle_de_pioche") {
    // Pas de Ça farte déjà posé sur une des courses que couvrirait ce 4e choix.
    const window = quatriemeChoixWindow(raceId, seasonRaces);
    return !cards.some(
      (c) => c.card_type === "ca_farte" && c.status === "used" && c.used_on_race_id && window.includes(c.used_on_race_id)
    );
  }
  return true;
}

/** Crédits de carte pas encore choisis : cartes gagnées au 10/10 moins cartes déjà prises. */
export function unclaimedCredits(cardsEarned: number, cardsHeld: number): number {
  return Math.max(0, cardsEarned - cardsHeld);
}

export interface PlayerCards {
  unclaimed: number;
  cards: BonusCardView[];
}

/** Toutes les courses de la saison, au format utilisé ici. */
export async function getSeasonCardRaces(supabase: SupabaseClient, seasonId: string): Promise<CardRace[]> {
  const { data } = await supabase
    .from("races")
    .select("id, format, sex, locks_at, status, stages!inner(season_id)")
    .eq("stages.season_id", seasonId);
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, format: r.format, sex: r.sex, locks_at: r.locks_at, status: r.status }));
}

/**
 * Cartes d'un joueur pour l'encadré « Série en cours » et le pop-up du Classement. Les cartes
 * d'un autre joueur sont lisibles grâce à la migration 0022.
 */
export async function getPlayerCards(supabase: SupabaseClient, seasonId: string, userId: string, now: Date): Promise<PlayerCards> {
  const [{ data: cards }, { data: streak }, races] = await Promise.all([
    supabase
      .from("bonus_cards")
      .select("id, card_type, status, used_on_race_id, earned_at")
      .eq("user_id", userId)
      .eq("season_id", seasonId)
      .order("earned_at", { ascending: true }),
    supabase.from("streak_counters").select("cards_earned").eq("user_id", userId).eq("season_id", seasonId).maybeSingle(),
    getSeasonCardRaces(supabase, seasonId),
  ]);
  const rows = (cards ?? []) as CardRow[];
  return {
    unclaimed: unclaimedCredits(streak?.cards_earned ?? 0, rows.length),
    cards: rows.map((c) => describeCard(c, races, now)),
  };
}

/**
 * Effet de carte retenu par le moteur de scoring pour un pronostic : ce sont les cartes jouées
 * (bonus_cards) qui font foi, pas le seul champ du pronostic. Sans 4e choix actif, seuls les
 * 3 premiers biathlètes du pronostic sont gardés.
 */
export function resolvePredictionCard(
  raceId: string,
  prediction: { athlete_ids: string[] | null; bonus_card_target_athlete_id: string | null },
  userCards: CardRow[],
  seasonRaces: CardRace[]
): { athleteIds: string[]; card: BonusCardEffect } {
  const athleteIds = prediction.athlete_ids ?? [];
  const { quatriemeChoix, caFarte } = cardsOnRace(raceId, userCards, seasonRaces);
  if (quatriemeChoix) return { athleteIds: athleteIds.slice(0, 4), card: { type: "balle_de_pioche" } };
  const counted = athleteIds.slice(0, 3);
  const target = prediction.bonus_card_target_athlete_id;
  if (caFarte && target && counted.includes(target)) {
    return { athleteIds: counted, card: { type: "ca_farte", targetAthleteId: target } };
  }
  return { athleteIds: counted, card: { type: "none" } };
}

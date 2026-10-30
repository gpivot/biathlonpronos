import type { SupabaseClient } from "@supabase/supabase-js";
import type { BonusCardEffect } from "./scoring/types";

/**
 * Cartes bonus gagnées au 10/10 (§12-13), choisies par le joueur (demandes de Guillaume, octobre 2026) :
 * - « Fondue » : dégrille une fois ses biathlètes, sur la course de son choix ;
 * - « Ça farte » : ×3 sur un biathlète d'une course individuelle, joué quand on veut ;
 * - « 4e choix » (`balle_de_pioche` en base) : 4 biathlètes au lieu de 3, les 3 meilleurs comptent,
 *   activé tout de suite sur 4 courses individuelles (2 hommes, 2 femmes) ;
 * - « Aspiration » (à partir de la 4e étape) : sur une course individuelle choisie, chacun des
 *   biathlètes pronostiqués compte une place plus haut ;
 * - « Équipe » (à partir de l'étape qui suit les Mondiaux/JO) : jusqu'à la fin de la saison, chaque
 *   biathlète de l'équipe favorite dans le Top 10 (ou sa nation dans le Top 10 du relais de son
 *   sexe) ajoute une fois sa cote aux points de la course.
 * Une même carte ne se prend pas sur deux 10/10 d'affilée. Une seule carte de course à la fois
 * (Ça farte, Aspiration, 4e choix) ; Fondue et Équipe se cumulent avec les autres.
 */

export const CLAIMABLE_CARD_TYPES = ["fondue", "ca_farte", "balle_de_pioche", "aspiration", "equipe"] as const;
export type ClaimableCardType = (typeof CLAIMABLE_CARD_TYPES)[number];
/** Cartes jouées par le joueur sur une course de son choix depuis le formulaire de pronostic. */
export type RaceCardType = "ca_farte" | "aspiration";
/** Cartes qui ne se cumulent pas sur une même course. */
const EXCLUSIVE_CARD_TYPES = ["ca_farte", "aspiration", "balle_de_pioche"];

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
  const raceIds = coveredRaceIds(card, seasonRaces);
  const races = raceIds.map((id) => raceById.get(id)).filter((r): r is CardRace => !!r);
  const active = races.some((r) => r.status !== "finished");
  const view: BonusCardView = { id: card.id, type: card.card_type, state: active ? "active" : "used" };
  if (card.card_type === "balle_de_pioche") {
    view.windowSize = races.length;
    view.windowStarted = races.filter((r) => new Date(r.locks_at) <= now).length;
  }
  return view;
}

/**
 * Courses couvertes par une carte jouée : la fenêtre du 4e choix, toutes les courses restantes de la
 * saison pour Équipe (à partir de la course d'activation, relais compris), sinon la course où elle
 * a été jouée.
 */
export function coveredRaceIds(card: CardRow, seasonRaces: CardRace[]): string[] {
  if (!card.used_on_race_id) return [];
  if (card.card_type === "balle_de_pioche") return quatriemeChoixWindow(card.used_on_race_id, seasonRaces);
  if (card.card_type === "equipe") {
    const activation = seasonRaces.find((r) => r.id === card.used_on_race_id);
    if (!activation) return [];
    const start = new Date(activation.locks_at).getTime();
    return seasonRaces.filter((r) => new Date(r.locks_at).getTime() >= start).map((r) => r.id);
  }
  return [card.used_on_race_id];
}

/** Cartes jouées par un joueur qui s'appliquent à une course donnée (moteur de scoring, formulaire). */
export function cardsOnRace(
  raceId: string,
  cards: CardRow[],
  seasonRaces: CardRace[]
): { quatriemeChoix: CardRow | null; caFarte: CardRow | null; aspiration: CardRow | null; equipe: CardRow | null } {
  const found = { quatriemeChoix: null as CardRow | null, caFarte: null as CardRow | null, aspiration: null as CardRow | null, equipe: null as CardRow | null };
  for (const card of cards) {
    if (card.status !== "used" || !coveredRaceIds(card, seasonRaces).includes(raceId)) continue;
    if (card.card_type === "ca_farte") found.caFarte = card;
    if (card.card_type === "aspiration") found.aspiration = card;
    if (card.card_type === "balle_de_pioche") found.quatriemeChoix = card;
    if (card.card_type === "equipe") found.equipe = card;
  }
  return found;
}

/** Une carte de course peut-elle être jouée sur cette course ? (une seule à la fois) */
export function canPlayCard(
  type: RaceCardType | "balle_de_pioche",
  raceId: string,
  cards: CardRow[],
  seasonRaces: CardRace[]
): boolean {
  const race = seasonRaces.find((r) => r.id === raceId);
  if (!race || isRelayFormat(race.format)) return false;
  if (!cards.some((c) => c.card_type === type && c.status === "available")) return false;
  const current = cardsOnRace(raceId, cards, seasonRaces);
  if (current.quatriemeChoix || current.caFarte || current.aspiration) return false;
  if (type === "balle_de_pioche") {
    // Pas de Ça farte ni d'Aspiration déjà posés sur une des courses que couvrirait ce 4e choix.
    const window = quatriemeChoixWindow(raceId, seasonRaces);
    return !cards.some(
      (c) =>
        EXCLUSIVE_CARD_TYPES.includes(c.card_type) && c.status === "used" && c.used_on_race_id && window.includes(c.used_on_race_id)
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
  /** Cartes du pop-up du 10/10 (proposées, verrouillées, ou prises au 10/10 précédent). */
  offers: { type: ClaimableCardType; state: OfferState }[];
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
  const [{ data: cards }, { data: streak }, races, { data: stages }] = await Promise.all([
    supabase
      .from("bonus_cards")
      .select("id, card_type, status, used_on_race_id, earned_at")
      .eq("user_id", userId)
      .eq("season_id", seasonId)
      .order("earned_at", { ascending: true }),
    supabase.from("streak_counters").select("cards_earned").eq("user_id", userId).eq("season_id", seasonId).maybeSingle(),
    getSeasonCardRaces(supabase, seasonId),
    supabase.from("stages").select("starts_on, coefficient, races(locks_at)").eq("season_id", seasonId),
  ]);
  const rows = (cards ?? []) as CardRow[];
  const cardStages: CardStage[] = ((stages ?? []) as any[]).map((st) => ({
    starts_on: st.starts_on,
    coefficient: st.coefficient,
    firstLocksAt: ((st.races ?? []) as { locks_at: string }[]).map((r) => r.locks_at).sort()[0] ?? null,
  }));
  return {
    unclaimed: unclaimedCredits(streak?.cards_earned ?? 0, rows.length),
    cards: rows.map((c) => describeCard(c, races, now)),
    offers: offeredCards(rows[rows.length - 1]?.card_type ?? null, cardStages, now),
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
  const { quatriemeChoix, caFarte, aspiration } = cardsOnRace(raceId, userCards, seasonRaces);
  const counted = athleteIds.slice(0, 3);
  const target = prediction.bonus_card_target_athlete_id;
  // Un 4e choix activé automatiquement peut couvrir une course où Ça farte ou Aspiration était déjà
  // posé : la carte jouée exprès par le joueur l'emporte sur cette course (à confirmer).
  if (caFarte && target && counted.includes(target)) {
    return { athleteIds: counted, card: { type: "ca_farte", targetAthleteId: target } };
  }
  if (aspiration) return { athleteIds: counted, card: { type: "aspiration" } };
  if (quatriemeChoix) return { athleteIds: athleteIds.slice(0, 4), card: { type: "balle_de_pioche" } };
  return { athleteIds: counted, card: { type: "none" } };
}

// --- Cartes proposées au 10/10 ---------------------------------------------------------------

export interface CardStage {
  starts_on: string;
  coefficient: number;
  /** Départ de la première course de l'étape (null : pas encore de course). */
  firstLocksAt: string | null;
}

/** Numéro (à partir de 1) de l'étape qui débloque la carte Aspiration. */
export const ASPIRATION_UNLOCK_STAGE = 4;
/** Étape qui débloque la carte Équipe quand la saison n'a ni Mondiaux ni JO. */
export const EQUIPE_FALLBACK_UNLOCK_STAGE = 7;

/**
 * Étape à partir de laquelle une carte peut être choisie (index dans les étapes triées par date),
 * null si elle l'est dès le début. Aspiration : la 4e étape. Équipe : l'étape qui suit les
 * Mondiaux/JO (coefficient 2), la 7e à défaut.
 */
export function cardUnlockStageIndex(type: string, stages: CardStage[]): number | null {
  if (type === "aspiration") return ASPIRATION_UNLOCK_STAGE - 1;
  if (type === "equipe") {
    const sorted = [...stages].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    const championships = sorted.findIndex((s) => s.coefficient === 2);
    return championships >= 0 ? championships + 1 : EQUIPE_FALLBACK_UNLOCK_STAGE - 1;
  }
  return null;
}

/** La carte est-elle débloquée ? (la première course de l'étape qui la débloque est partie) */
export function isCardUnlocked(type: string, stages: CardStage[], now: Date): boolean {
  const index = cardUnlockStageIndex(type, stages);
  if (index == null) return true;
  const stage = [...stages].sort((a, b) => a.starts_on.localeCompare(b.starts_on))[index];
  return !!stage?.firstLocksAt && new Date(stage.firstLocksAt) <= now;
}

export type OfferState = "offered" | "locked" | "justTaken";

/**
 * Cartes du pop-up du 10/10 : verrouillées tant que leur étape n'a pas commencé, et grisées si
 * c'est la carte prise au 10/10 précédent (une même carte pas deux fois d'affilée).
 */
export function offeredCards(
  previousClaimedType: string | null,
  stages: CardStage[],
  now: Date
): { type: ClaimableCardType; state: OfferState }[] {
  return CLAIMABLE_CARD_TYPES.map((type) => ({
    type,
    state: !isCardUnlocked(type, stages, now) ? "locked" : type === previousClaimedType ? "justTaken" : "offered",
  }));
}

// --- Carte Équipe ------------------------------------------------------------------------------

/**
 * Points de la carte Équipe sur une course : une fois la cote de chaque biathlète de l'équipe
 * favorite classé dans le Top 10 (course individuelle du même sexe), ou une fois la cote du relais
 * si la nation y finit dans le Top 10 (relais hommes ou femmes du sexe de l'équipe). Pas de
 * coefficient : « on ajoute une fois sa cote ».
 */
export function computeEquipeBonus(
  favoriteTeam: { nationCode: string; sex: string } | null,
  race: { format: string; sex: string | null },
  individual: { rank: number; nationCode: string; sex: string; odds: number }[],
  relay: { rank: number; nationCode: string; odds: number }[]
): number {
  if (!favoriteTeam) return 0;
  if (isRelayFormat(race.format)) {
    const relayFormat = favoriteTeam.sex === "H" ? "relais_h" : "relais_f";
    if (race.format !== relayFormat) return 0;
    const team = relay.find((r) => r.nationCode === favoriteTeam.nationCode && r.rank <= 10);
    return team ? team.odds : 0;
  }
  if (race.sex !== favoriteTeam.sex) return 0;
  return individual
    .filter((r) => r.rank <= 10 && r.nationCode === favoriteTeam.nationCode && r.sex === favoriteTeam.sex)
    .reduce((sum, r) => sum + r.odds, 0);
}

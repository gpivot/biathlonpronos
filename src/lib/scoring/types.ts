export type Sex = "H" | "F";

export type SpecialRule = "tour_de_pena" | "brouillard" | "tes_colle" | null;

/** Résultat d'un athlète sur une course individuelle (table race_results). */
export interface AthleteRaceResult {
  athleteId: string;
  rank: number;
  penaltyLaps?: number;
  isFusee?: boolean;
  isGachette?: boolean;
}

export type BonusCardEffect =
  | { type: "none" }
  | { type: "balle_de_pioche" } // 4 choix pronostiqués, seuls les 3 meilleurs comptent
  | { type: "ca_farte"; targetAthleteId: string }; // ×3 sur un athlète choisi
// "fondue" (dégrillage) et "chat_noir" (correction des globes de saison)
// n'affectent pas le calcul des points d'une course — traités ailleurs.

export interface FavoriteTeam {
  nationCode: string;
  sex: Sex;
}

export interface IndividualRaceScoringInput {
  /** 3 athlètes pronostiqués, ou 4 si carte "balle_de_pioche" active. */
  predictedAthleteIds: string[];
  /** Tous les résultats connus de la course (Top 10 au minimum ; le classement complet pour "brouillard"/"tes_colle"). */
  results: AthleteRaceResult[];
  /** Cote effective par athlète pour cette course (cote poursuite déjà recalculée en amont). */
  oddsByAthleteId: Record<string, number>;
  /** Nation/sexe de chaque athlète pronostiqué, nécessaire au bonus Team Nation. */
  athleteTeamByAthleteId: Record<string, { nationCode: string; sex: Sex }>;
  specialRule: SpecialRule;
  /** 2 si Mondiaux/JO, sinon 1. */
  stageCoefficient: 1 | 2;
  /** Bonus ×2 personnel de saison activé sur cette course (ignoré si stageCoefficient === 2, non cumulables). */
  bonusX2Active: boolean;
  card: BonusCardEffect;
  favoriteTeam: FavoriteTeam | null;
  /** Code nation du pays hôte de l'étape — nécessaire au bonus Team Nation. */
  raceCountryCode: string;
}

export interface IndividualRaceScoringResult {
  total: number;
  /** Contribution finale par athlète pronostiqué (après cartes, coefficient, Team Nation). */
  perAthlete: Record<string, number>;
  breakdown: {
    /** Points de base par athlète (barème cote × rang, avant cartes/coefficient/Team Nation). */
    base: Record<string, number>;
    combinationBonus: number;
    pronoParfaitBonus: number;
    specialMalus: number;
    fuseeGachetteBonus: number;
    /** Athlètes exclus du score car carte "balle de pioche" retient les 3 meilleurs sur 4. */
    droppedByBalleDePioche: string[];
    /** Athlète(s) dont les points ont été doublés par le bonus Team Nation. */
    teamNationBoostedAthleteIds: string[];
  };
}

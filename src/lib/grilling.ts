// §2 — grillage : les biathlètes choisis sur une course sont grillés pour la
// course suivante de la même étape (et seulement celle-là).

export const RELAY_FORMATS = ["relais_h", "relais_f", "relais_mixte", "relais_mixte_simple"];

export interface StageRace {
  id: string;
  format: string;
  sex: string | null;
  locks_at: string;
}

/**
 * Course individuelle précédente de la même étape, pour le même sexe, dont les
 * choix grillent ceux de `race`. Les relais et les courses de l'autre sexe sont
 * ignorés (à confirmer : un sprint femmes grille la poursuite femmes même si un
 * sprint hommes s'intercale). `null` pour la première course de l'étape.
 */
export function previousRaceForGrilling(race: StageRace, stageRaces: StageRace[]): StageRace | null {
  const raceTime = new Date(race.locks_at).getTime();
  const candidates = stageRaces
    .filter(
      (r) =>
        r.id !== race.id &&
        !RELAY_FORMATS.includes(r.format) &&
        r.sex === race.sex &&
        new Date(r.locks_at).getTime() < raceTime
    )
    .sort((a, b) => new Date(b.locks_at).getTime() - new Date(a.locks_at).getTime());
  return candidates[0] ?? null;
}

/**
 * Suppression de compte : que deviennent les ligues créées par le joueur ? La plus ancienne
 * recrue restante en devient propriétaire ; une ligue sans autre membre est supprimée.
 */
export interface Membership {
  league_id: string;
  user_id: string;
  joined_at: string;
}

export type LeagueFate = { leagueId: string; newOwnerId: string } | { leagueId: string; delete: true };

export function leagueFates(ownedLeagueIds: string[], memberships: Membership[], leavingUserId: string): LeagueFate[] {
  return ownedLeagueIds.map((leagueId) => {
    const heir = memberships
      .filter((m) => m.league_id === leagueId && m.user_id !== leavingUserId)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.user_id.localeCompare(b.user_id))[0];
    return heir ? { leagueId, newOwnerId: heir.user_id } : { leagueId, delete: true as const };
  });
}

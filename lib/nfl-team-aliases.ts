/**
 * Older NFL data sources often emit historical franchise abbreviations.
 * We centralize that translation here so provider adapters and any future
 * import helpers normalize to the current master NFLTeam abbreviations.
 */
const NFL_TEAM_ALIAS_MAP: Record<string, string> = {
  JAC: "JAX",
  LA: "LAR",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
  WSH: "WAS"
};

export function normalizeNflTeamAbbreviation(value: string) {
  const normalized = value.trim().toUpperCase();
  return NFL_TEAM_ALIAS_MAP[normalized] ?? normalized;
}

export function getNflTeamAliasMap() {
  return { ...NFL_TEAM_ALIAS_MAP };
}

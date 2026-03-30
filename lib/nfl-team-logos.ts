const NFL_TEAM_LOGO_URLS: Record<string, string> = {
  ARI: "https://a.espncdn.com/i/teamlogos/nfl/500/ari.png",
  ATL: "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png",
  BAL: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png",
  BUF: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
  CAR: "https://a.espncdn.com/i/teamlogos/nfl/500/car.png",
  CHI: "https://a.espncdn.com/i/teamlogos/nfl/500/chi.png",
  CIN: "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png",
  CLE: "https://a.espncdn.com/i/teamlogos/nfl/500/cle.png",
  DAL: "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png",
  DEN: "https://a.espncdn.com/i/teamlogos/nfl/500/den.png",
  DET: "https://a.espncdn.com/i/teamlogos/nfl/500/det.png",
  GB: "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png",
  HOU: "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png",
  IND: "https://a.espncdn.com/i/teamlogos/nfl/500/ind.png",
  JAX: "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png",
  KC: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
  LV: "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png",
  LAC: "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png",
  LAR: "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png",
  MIA: "https://a.espncdn.com/i/teamlogos/nfl/500/mia.png",
  MIN: "https://a.espncdn.com/i/teamlogos/nfl/500/min.png",
  NE: "https://a.espncdn.com/i/teamlogos/nfl/500/ne.png",
  NO: "https://a.espncdn.com/i/teamlogos/nfl/500/no.png",
  NYG: "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png",
  NYJ: "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png",
  PHI: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png",
  PIT: "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png",
  SF: "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png",
  SEA: "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png",
  TB: "https://a.espncdn.com/i/teamlogos/nfl/500/tb.png",
  TEN: "https://a.espncdn.com/i/teamlogos/nfl/500/ten.png",
  WAS: "https://a.espncdn.com/i/teamlogos/nfl/500/was.png"
};

export function normalizeNFLTeamAbbreviation(abbreviation: string) {
  return abbreviation.trim().toUpperCase();
}

export function getNFLTeamLogoUrl(abbreviation: string) {
  return NFL_TEAM_LOGO_URLS[normalizeNFLTeamAbbreviation(abbreviation)] ?? null;
}

export function formatNFLTeamLabel(team: { abbreviation: string; name: string }) {
  return `${normalizeNFLTeamAbbreviation(team.abbreviation)} - ${team.name}`;
}

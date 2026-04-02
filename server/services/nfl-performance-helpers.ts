import type { SeasonNflResultPhase } from "@/types/nfl-performance";

import { NflPerformanceServiceError } from "@/server/services/nfl-performance-errors";

export function getRegularSeasonWeekLimit(seasonYear: number) {
  return seasonYear >= 2021 ? 18 : 17;
}

export function getExpectedWeekForPhase(seasonYear: number, phase: SeasonNflResultPhase) {
  const regularSeasonWeekLimit = getRegularSeasonWeekLimit(seasonYear);

  switch (phase) {
    case "REGULAR_SEASON":
      return null;
    case "WILD_CARD":
      return regularSeasonWeekLimit + 1;
    case "DIVISIONAL":
      return regularSeasonWeekLimit + 2;
    case "CONFERENCE":
      return regularSeasonWeekLimit + 3;
    case "SUPER_BOWL":
      return regularSeasonWeekLimit + 4;
    default:
      return null;
  }
}

export function createSeasonWeekKey(weekNumber: number, phase: SeasonNflResultPhase) {
  return `${phase}:${weekNumber}`;
}

export function validateSeasonWeekPhase(seasonYear: number, weekNumber: number, phase: SeasonNflResultPhase) {
  if (phase === "REGULAR_SEASON") {
    const maxWeek = getRegularSeasonWeekLimit(seasonYear);

    if (weekNumber < 1 || weekNumber > maxWeek) {
      throw new NflPerformanceServiceError(
        `Regular season week numbers must be between 1 and ${maxWeek} for the ${seasonYear} NFL season.`,
        400
      );
    }

    return;
  }

  const expectedWeek = getExpectedWeekForPhase(seasonYear, phase);

  if (expectedWeek === null) {
    throw new NflPerformanceServiceError("NFL result phase is invalid.", 400);
  }

  if (weekNumber !== expectedWeek) {
    throw new NflPerformanceServiceError(
      `${phase.replaceAll("_", " ")} must use week ${expectedWeek} for the ${seasonYear} NFL season.`,
      400
    );
  }
}

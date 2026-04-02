import { nflverseProvider } from "@/server/providers/nfl/nflverse-provider";

export const nflResultsProviders = {
  NFLVERSE: nflverseProvider
} as const;

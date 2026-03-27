import { csvAdapter } from "@/server/services/ingestion/providers/csv-adapter";
import { espnAdapter } from "@/server/services/ingestion/providers/espn-adapter";
import { sleeperAdapter } from "@/server/services/ingestion/providers/sleeper-adapter";

export const ingestionProviderAdapters = {
  CSV: csvAdapter,
  ESPN: espnAdapter,
  SLEEPER: sleeperAdapter
};

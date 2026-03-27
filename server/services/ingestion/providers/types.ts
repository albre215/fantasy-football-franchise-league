import type {
  IngestionImportType,
  IngestionProvider,
  NormalizedImportPreview,
  PreviewIngestionInput
} from "@/types/ingestion";

export interface IngestionProviderContext {
  seasonId: string;
  seasonLabel: string;
  importType: IngestionImportType;
  provider: IngestionProvider;
  weekNumber: number | null;
  externalLeagueId: string | null;
  externalSeasonKey: string | null;
  config: Record<string, string | number | boolean | null>;
  csvContent: string | null;
}

export interface IngestionProviderAdapter {
  provider: IngestionProvider;
  preview(context: IngestionProviderContext): Promise<Omit<NormalizedImportPreview, "mappings">>;
}

export function normalizePreviewInput(
  input: PreviewIngestionInput,
  seasonLabel: string
): IngestionProviderContext {
  return {
    seasonId: input.seasonId.trim(),
    seasonLabel,
    importType: input.importType,
    provider: input.provider,
    weekNumber: input.weekNumber ?? null,
    externalLeagueId: input.externalLeagueId?.trim() || null,
    externalSeasonKey: input.externalSeasonKey?.trim() || null,
    config: input.config ?? {},
    csvContent: input.csvContent?.trim() || null
  };
}

import { IngestionImportType, IngestionProvider, IngestionRunStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ingestionProviderAdapters } from "@/server/services/ingestion/providers";
import { normalizePreviewInput } from "@/server/services/ingestion/providers/types";
import type {
  ImportedRecordMappingCandidate,
  IngestionRunSummary,
  PreviewIngestionInput,
  RunIngestionInput,
  SaveSeasonSourceConfigInput,
  SeasonSourceConfigSummary,
  NormalizedImportPreview
} from "@/types/ingestion";

class IngestionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "IngestionServiceError";
  }
}

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

function normalizeLooseString(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mapConfig(config: {
  id: string;
  seasonId: string;
  provider: IngestionProvider;
  externalLeagueId: string | null;
  externalSeasonKey: string | null;
  config: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): SeasonSourceConfigSummary {
  return {
    id: config.id,
    seasonId: config.seasonId,
    provider: config.provider,
    externalLeagueId: config.externalLeagueId,
    externalSeasonKey: config.externalSeasonKey,
    config: (config.config as Record<string, string | number | boolean | null>) ?? {},
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString()
  };
}

function mapRun(run: {
  id: string;
  provider: IngestionProvider;
  importType: IngestionImportType;
  status: IngestionRunStatus;
  weekNumber: number | null;
  actingUserId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  warnings: Prisma.JsonValue | null;
  errorMessage: string | null;
  sourceSummary: Prisma.JsonValue | null;
}): IngestionRunSummary {
  return {
    id: run.id,
    provider: run.provider,
    importType: run.importType,
    status: run.status,
    weekNumber: run.weekNumber,
    actingUserId: run.actingUserId,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    warnings: Array.isArray(run.warnings) ? (run.warnings as string[]) : [],
    errorMessage: run.errorMessage,
    sourceSummary: run.sourceSummary
      ? (run.sourceSummary as IngestionRunSummary["sourceSummary"])
      : null
  };
}

async function getSeasonContext(tx: PrismaClientLike, seasonId: string) {
  const season = await tx.season.findUnique({
    where: {
      id: seasonId
    },
    include: {
      league: {
        include: {
          members: {
            include: {
              user: true
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
          }
        }
      },
      sourceConfigs: {
        include: {
          mappings: true
        }
      }
    }
  });

  if (!season) {
    throw new IngestionServiceError("Season not found.", 404);
  }

  return season;
}

async function assertCommissionerAccess(tx: PrismaClientLike, seasonId: string, actingUserId: string) {
  const season = await getSeasonContext(tx, seasonId);
  const commissioner = season.league.members.find(
    (member) => member.userId === actingUserId.trim() && member.role === "COMMISSIONER"
  );

  if (!commissioner) {
    throw new IngestionServiceError("Only the commissioner can manage ingestion for this season.", 403);
  }

  return season;
}

function buildMappingCandidates(
  preview: Omit<NormalizedImportPreview, "mappings">,
  season: Awaited<ReturnType<typeof getSeasonContext>>,
  provider: IngestionProvider
): ImportedRecordMappingCandidate[] {
  const sourceConfig = season.sourceConfigs.find((config) => config.provider === provider);
  const existingMappings = new Map(
    (sourceConfig?.mappings ?? []).map((mapping) => [mapping.externalEntityId, mapping])
  );
  const members = season.league.members;
  const rawRecords =
    preview.importType === "SEASON_STANDINGS" ? preview.records.seasonStandings : preview.records.weeklyStandings;

  return rawRecords.map((record) => {
    const existingMapping = existingMappings.get(record.externalEntityId);

    if (existingMapping) {
      return {
        externalEntityId: record.externalEntityId,
        externalDisplayName: record.externalDisplayName,
        suggestedLeagueMemberId: existingMapping.leagueMemberId,
        matchedLeagueMemberId: existingMapping.leagueMemberId,
        status: "MATCHED",
        confidenceScore: existingMapping.confidence ?? 100
      };
    }

    const exactMatch = members.find((member) => {
      const normalizedExternal = normalizeLooseString(record.externalDisplayName);

      return (
        normalizeLooseString(member.user.displayName) === normalizedExternal ||
        normalizeLooseString(member.user.email) === normalizedExternal
      );
    });

    if (exactMatch) {
      return {
        externalEntityId: record.externalEntityId,
        externalDisplayName: record.externalDisplayName,
        suggestedLeagueMemberId: exactMatch.id,
        matchedLeagueMemberId: exactMatch.id,
        status: "REQUIRES_REVIEW",
        confidenceScore: 85
      };
    }

    return {
      externalEntityId: record.externalEntityId,
      externalDisplayName: record.externalDisplayName,
      suggestedLeagueMemberId: null,
      matchedLeagueMemberId: null,
      status: "UNMATCHED",
      confidenceScore: null
    };
  });
}

async function buildPreview(tx: PrismaClientLike, input: PreviewIngestionInput) {
  const season = await getSeasonContext(tx, input.seasonId.trim());
  const savedConfig = season.sourceConfigs.find((config) => config.provider === input.provider);
  const mergedConfig = {
    ...((savedConfig?.config as Record<string, string | number | boolean | null>) ?? {}),
    ...(input.config ?? {})
  };

  const adapter = ingestionProviderAdapters[input.provider];

  if (!adapter) {
    throw new IngestionServiceError("Unsupported ingestion provider.", 400);
  }

  const preview = await adapter.preview(
    normalizePreviewInput(
      {
        ...input,
        externalLeagueId: input.externalLeagueId ?? savedConfig?.externalLeagueId ?? undefined,
        externalSeasonKey: input.externalSeasonKey ?? savedConfig?.externalSeasonKey ?? undefined,
        config: mergedConfig
      },
      season.name ?? `${season.year} Season`
    )
  );

  return {
    season,
    preview: {
      ...preview,
      mappings: buildMappingCandidates(preview, season, input.provider)
    }
  };
}

function resolveRecordMappings(
  preview: NormalizedImportPreview,
  mappingOverrides: Record<string, string> | undefined
) {
  const resolved = new Map<string, string>();
  const unresolved: string[] = [];

  for (const mapping of preview.mappings) {
    const override = mappingOverrides?.[mapping.externalEntityId]?.trim();
    const leagueMemberId = override || mapping.matchedLeagueMemberId || mapping.suggestedLeagueMemberId || "";

    if (!leagueMemberId) {
      unresolved.push(mapping.externalDisplayName);
      continue;
    }

    resolved.set(mapping.externalEntityId, leagueMemberId);
  }

  if (unresolved.length > 0) {
    throw new IngestionServiceError(
      `Review member mappings before import. Missing matches: ${unresolved.join(", ")}.`,
      409
    );
  }

  return resolved;
}

export const ingestionService = {
  async getSeasonSourceConfigs(seasonId: string) {
    const season = await getSeasonContext(prisma, seasonId.trim());

    return season.sourceConfigs.map(mapConfig);
  },

  async saveSeasonSourceConfig(input: SaveSeasonSourceConfigInput) {
    const seasonId = input.seasonId.trim();
    const actingUserId = input.actingUserId.trim();

    if (!seasonId || !actingUserId) {
      throw new IngestionServiceError("seasonId and actingUserId are required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      await assertCommissionerAccess(tx, seasonId, actingUserId);

      const config = await tx.seasonSourceConfig.upsert({
        where: {
          seasonId_provider: {
            seasonId,
            provider: input.provider
          }
        },
        create: {
          seasonId,
          provider: input.provider,
          externalLeagueId: input.externalLeagueId?.trim() || null,
          externalSeasonKey: input.externalSeasonKey?.trim() || null,
          config: input.config ?? {}
        },
        update: {
          externalLeagueId: input.externalLeagueId?.trim() || null,
          externalSeasonKey: input.externalSeasonKey?.trim() || null,
          config: input.config ?? {}
        }
      });

      return mapConfig(config);
    });
  },

  async previewImport(input: PreviewIngestionInput) {
    const seasonId = input.seasonId.trim();

    if (!seasonId) {
      throw new IngestionServiceError("seasonId is required.", 400);
    }

    const { preview } = await buildPreview(prisma, input);
    return preview;
  },

  async runImport(input: RunIngestionInput) {
    const seasonId = input.seasonId.trim();
    const actingUserId = input.actingUserId.trim();

    if (!seasonId || !actingUserId) {
      throw new IngestionServiceError("seasonId and actingUserId are required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const season = await assertCommissionerAccess(tx, seasonId, actingUserId);
      const sourceConfig = await tx.seasonSourceConfig.upsert({
        where: {
          seasonId_provider: {
            seasonId,
            provider: input.provider
          }
        },
        create: {
          seasonId,
          provider: input.provider,
          externalLeagueId: input.externalLeagueId?.trim() || null,
          externalSeasonKey: input.externalSeasonKey?.trim() || null,
          config: input.config ?? {}
        },
        update: {
          externalLeagueId: input.externalLeagueId?.trim() || null,
          externalSeasonKey: input.externalSeasonKey?.trim() || null,
          config: {
            ...((season.sourceConfigs.find((config) => config.provider === input.provider)?.config as Record<
              string,
              string | number | boolean | null
            >) ?? {}),
            ...(input.config ?? {})
          }
        }
      });

      const { preview } = await buildPreview(tx, input);
      const resolvedMappings = resolveRecordMappings(preview, input.mappingOverrides);

      const run = await tx.ingestionRun.create({
        data: {
          seasonId,
          seasonSourceConfigId: sourceConfig.id,
          provider: input.provider,
          importType: input.importType,
          status: "RUNNING",
          weekNumber: input.weekNumber ?? null,
          actingUserId,
          sourceSummary: preview.sourceSummary,
          warnings: preview.warnings
        }
      });

      let mappingsStored = 0;
      for (const mapping of preview.mappings) {
        const leagueMemberId = resolvedMappings.get(mapping.externalEntityId);

        if (!leagueMemberId) {
          continue;
        }

        await tx.seasonMemberSourceMapping.upsert({
          where: {
            seasonSourceConfigId_externalEntityId: {
              seasonSourceConfigId: sourceConfig.id,
              externalEntityId: mapping.externalEntityId
            }
          },
          create: {
            seasonSourceConfigId: sourceConfig.id,
            leagueMemberId,
            externalEntityId: mapping.externalEntityId,
            externalDisplayName: mapping.externalDisplayName,
            confidence: mapping.confidenceScore ?? undefined
          },
          update: {
            leagueMemberId,
            externalDisplayName: mapping.externalDisplayName,
            confidence: mapping.confidenceScore ?? undefined
          }
        });
        mappingsStored += 1;
      }

      let seasonStandingCount = 0;
      let weeklyStandingCount = 0;

      if (input.importType === "SEASON_STANDINGS") {
        for (const record of preview.records.seasonStandings) {
          const leagueMemberId = resolvedMappings.get(record.externalEntityId);

          if (!leagueMemberId) {
            continue;
          }

          await tx.seasonStanding.upsert({
            where: {
              seasonId_leagueMemberId: {
                seasonId,
                leagueMemberId
              }
            },
            create: {
              seasonId,
              leagueMemberId,
              provider: input.provider,
              seasonSourceConfigId: sourceConfig.id,
              ingestionRunId: run.id,
              externalEntityId: record.externalEntityId,
              externalDisplayName: record.externalDisplayName,
              rank: record.rank,
              wins: record.wins,
              losses: record.losses,
              ties: record.ties,
              pointsFor: record.pointsFor,
              pointsAgainst: record.pointsAgainst,
              playoffFinish: record.playoffFinish,
              isChampion: record.isChampion,
              metadata: record.metadata
            },
            update: {
              provider: input.provider,
              seasonSourceConfigId: sourceConfig.id,
              ingestionRunId: run.id,
              externalEntityId: record.externalEntityId,
              externalDisplayName: record.externalDisplayName,
              rank: record.rank,
              wins: record.wins,
              losses: record.losses,
              ties: record.ties,
              pointsFor: record.pointsFor,
              pointsAgainst: record.pointsAgainst,
              playoffFinish: record.playoffFinish,
              isChampion: record.isChampion,
              metadata: record.metadata
            }
          });
          seasonStandingCount += 1;
        }
      }

      if (input.importType === "WEEKLY_STANDINGS") {
        for (const record of preview.records.weeklyStandings) {
          const leagueMemberId = resolvedMappings.get(record.externalEntityId);

          if (!leagueMemberId) {
            continue;
          }

          await tx.weeklyStanding.upsert({
            where: {
              seasonId_weekNumber_leagueMemberId: {
                seasonId,
                weekNumber: record.weekNumber,
                leagueMemberId
              }
            },
            create: {
              seasonId,
              weekNumber: record.weekNumber,
              leagueMemberId,
              provider: input.provider,
              seasonSourceConfigId: sourceConfig.id,
              ingestionRunId: run.id,
              externalEntityId: record.externalEntityId,
              externalDisplayName: record.externalDisplayName,
              rank: record.rank,
              pointsFor: record.pointsFor,
              pointsAgainst: record.pointsAgainst,
              result: record.result,
              opponentExternalEntityId: record.opponentExternalEntityId,
              opponentDisplayName: record.opponentDisplayName,
              metadata: record.metadata
            },
            update: {
              provider: input.provider,
              seasonSourceConfigId: sourceConfig.id,
              ingestionRunId: run.id,
              externalEntityId: record.externalEntityId,
              externalDisplayName: record.externalDisplayName,
              rank: record.rank,
              pointsFor: record.pointsFor,
              pointsAgainst: record.pointsAgainst,
              result: record.result,
              opponentExternalEntityId: record.opponentExternalEntityId,
              opponentDisplayName: record.opponentDisplayName,
              metadata: record.metadata
            }
          });
          weeklyStandingCount += 1;
        }
      }

      const completedRun = await tx.ingestionRun.update({
        where: {
          id: run.id
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });

      return {
        run: mapRun(completedRun),
        importedCounts: {
          seasonStandings: seasonStandingCount,
          weeklyStandings: weeklyStandingCount,
          mappingsStored
        }
      };
    });
  },

  async listIngestionRuns(seasonId: string) {
    const normalizedSeasonId = seasonId.trim();

    if (!normalizedSeasonId) {
      throw new IngestionServiceError("seasonId is required.", 400);
    }

    const runs = await prisma.ingestionRun.findMany({
      where: {
        seasonId: normalizedSeasonId
      },
      orderBy: {
        startedAt: "desc"
      }
    });

    return runs.map(mapRun);
  }
};

export { IngestionServiceError };

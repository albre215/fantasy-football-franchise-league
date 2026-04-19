import { DraftType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { seasonService } from "@/server/services/season-service";

export class DraftScheduleServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = "DraftScheduleServiceError";
  }
}

export interface DraftScheduleSummary {
  id: string;
  seasonId: string;
  draftType: DraftType;
  scheduledAt: string;
  timezone: string;
}

function serialize(schedule: {
  id: string;
  seasonId: string;
  draftType: DraftType;
  scheduledAt: Date;
  timezone: string;
}): DraftScheduleSummary {
  return {
    id: schedule.id,
    seasonId: schedule.seasonId,
    draftType: schedule.draftType,
    scheduledAt: schedule.scheduledAt.toISOString(),
    timezone: schedule.timezone
  };
}

export interface UpsertDraftScheduleInput {
  seasonId: string;
  actingUserId: string;
  draftType: DraftType;
  scheduledAt: Date;
  timezone: string;
}

export const draftScheduleService = {
  async getBySeason(seasonId: string): Promise<DraftScheduleSummary | null> {
    const schedule = await prisma.draftSchedule.findUnique({ where: { seasonId } });
    return schedule ? serialize(schedule) : null;
  },

  async upsert(input: UpsertDraftScheduleInput): Promise<DraftScheduleSummary> {
    await seasonService.assertCommissionerAccess(input.seasonId, input.actingUserId);

    if (Number.isNaN(input.scheduledAt.getTime())) {
      throw new DraftScheduleServiceError("Scheduled date is invalid.", 400);
    }

    if (!input.timezone || typeof input.timezone !== "string") {
      throw new DraftScheduleServiceError("Timezone is required.", 400);
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
    } catch {
      throw new DraftScheduleServiceError(`Timezone "${input.timezone}" is invalid.`, 400);
    }

    const schedule = await prisma.draftSchedule.upsert({
      where: { seasonId: input.seasonId },
      create: {
        seasonId: input.seasonId,
        draftType: input.draftType,
        scheduledAt: input.scheduledAt,
        timezone: input.timezone
      },
      update: {
        draftType: input.draftType,
        scheduledAt: input.scheduledAt,
        timezone: input.timezone
      }
    });

    return serialize(schedule);
  },

  async clear(seasonId: string, actingUserId: string): Promise<void> {
    await seasonService.assertCommissionerAccess(seasonId, actingUserId);
    await prisma.draftSchedule.deleteMany({ where: { seasonId } });
  }
};

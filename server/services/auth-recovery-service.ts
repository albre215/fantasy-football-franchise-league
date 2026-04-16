import crypto from "crypto";
import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
  RecoveryDeliveryServiceError,
  getRecoverySmsMode,
  recoveryDeliveryService
} from "@/server/services/recovery-delivery-service";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const TEMP_LOGIN_CODE_TTL_MINUTES = 10;
const TWILIO_VERIFY_CHALLENGE_SENTINEL = "__twilio_verify__";
const PASSWORD_RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const TEMP_LOGIN_REQUEST_COOLDOWN_MS = 60 * 1000;
const TEMP_LOGIN_MAX_ATTEMPTS = 5;
const TEMP_LOGIN_LOCKOUT_THRESHOLD = 3;
const TEMP_LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

class AuthRecoveryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "AuthRecoveryServiceError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createTemporaryLoginCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthRecoveryServiceError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, 400);
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new AuthRecoveryServiceError(
      `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer to avoid bcrypt truncation.`,
      400
    );
  }
}

async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      phoneNumber: true,
      passwordHash: true
    }
  });
}

async function getUserByPhoneNumber(phoneNumberInput: string) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumberInput);

  if (!normalizedPhoneNumber) {
    return null;
  }

  const users = await prisma.user.findMany({
    where: {
      phoneNumber: {
        not: null
      }
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      phoneNumber: true,
      passwordHash: true
    }
  });

  return users.find((user) => normalizePhoneNumber(user.phoneNumber ?? "") === normalizedPhoneNumber) ?? null;
}

async function getMostRecentActivePasswordResetToken(userId: string) {
  return prisma.passwordResetToken.findFirst({
    where: {
      userId,
      consumedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      createdAt: true
    }
  });
}

async function getMostRecentActiveTemporaryLoginCode(userId: string) {
  return prisma.temporaryLoginCode.findFirst({
    where: {
      userId,
      consumedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      createdAt: true
    }
  });
}

function isWithinCooldown(timestamp: Date, cooldownMs: number) {
  return Date.now() - timestamp.getTime() < cooldownMs;
}

export const authRecoveryService = {
  async requestPasswordReset(emailInput: string) {
    const email = normalizeEmail(emailInput);

    if (!email) {
      throw new AuthRecoveryServiceError("Email is required.", 400);
    }

    const user = await getUserByEmail(email);

    if (!user) {
      throw new AuthRecoveryServiceError("That email is not tied to an account.", 404);
    }

    const recentToken = await getMostRecentActivePasswordResetToken(user.id);

    if (recentToken && isWithinCooldown(recentToken.createdAt, PASSWORD_RESET_REQUEST_COOLDOWN_MS)) {
      throw new AuthRecoveryServiceError("Please wait a moment before requesting another password reset email.", 429);
    }

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id
      }
    });

    const rawToken = createPasswordResetToken();
    const tokenHash = hashValue(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    const baseUrl = recoveryDeliveryService.getAppBaseUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    let delivery;

    try {
      delivery = await recoveryDeliveryService.sendPasswordResetEmail({
        email: user.email,
        resetUrl
      });
    } catch (error) {
      if (error instanceof RecoveryDeliveryServiceError) {
        throw new AuthRecoveryServiceError(error.message, 500);
      }

      throw error;
    }

    return {
      delivery,
      email: user.email
    };
  },

  async createTemporaryLoginCode(phoneNumberInput: string) {
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumberInput);

    if (!normalizedPhoneNumber) {
      throw new AuthRecoveryServiceError("Phone number is required.", 400);
    }

    const user = await getUserByPhoneNumber(normalizedPhoneNumber);

    if (!user) {
      throw new AuthRecoveryServiceError("That phone number is not tied to an account.", 404);
    }

    if (!user.phoneNumber?.trim()) {
      throw new AuthRecoveryServiceError("This account does not have a phone number on file for temporary login.", 400);
    }

    const recentChallenge = await getMostRecentActiveTemporaryLoginCode(user.id);

    if (recentChallenge && isWithinCooldown(recentChallenge.createdAt, TEMP_LOGIN_REQUEST_COOLDOWN_MS)) {
      throw new AuthRecoveryServiceError("Please wait a moment before requesting another login code.", 429);
    }

    await prisma.temporaryLoginCode.deleteMany({
      where: {
        userId: user.id
      }
    });

    const expiresAt = new Date(Date.now() + TEMP_LOGIN_CODE_TTL_MINUTES * 60 * 1000);
    const smsMode = getRecoverySmsMode();
    let codeHash = TWILIO_VERIFY_CHALLENGE_SENTINEL;
    let delivery;

    if (smsMode === "preview") {
      const rawCode = createTemporaryLoginCode();
      codeHash = await hash(rawCode, 10);

      try {
        delivery = await recoveryDeliveryService.sendTemporaryLoginCode({
          phoneNumber: user.phoneNumber,
          code: rawCode
        });
      } catch (error) {
        if (error instanceof RecoveryDeliveryServiceError) {
          throw new AuthRecoveryServiceError(error.message, 500);
        }

        throw error;
      }
    } else {
      try {
        delivery = await recoveryDeliveryService.sendTemporaryLoginCode({
          phoneNumber: user.phoneNumber
        });
      } catch (error) {
        if (error instanceof RecoveryDeliveryServiceError) {
          throw new AuthRecoveryServiceError(error.message, 500);
        }

        throw error;
      }
    }

    const challenge = await prisma.temporaryLoginCode.create({
      data: {
        userId: user.id,
        codeHash,
        phoneNumberSnapshot: user.phoneNumber,
        expiresAt
      },
      select: {
        id: true
      }
    });

    return {
      challengeId: challenge.id,
      delivery
    };
  },

  async verifyTemporaryLoginCode(challengeId: string, code: string) {
    if (!challengeId.trim() || !code.trim()) {
      throw new AuthRecoveryServiceError("Code verification requires both a challenge and a code.", 400);
    }

    const challenge = await prisma.temporaryLoginCode.findUnique({
      where: {
        id: challengeId
      },
      include: {
        user: true
      }
    });

    if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
      throw new AuthRecoveryServiceError("That temporary login code has expired. Request a new code and try again.", 400);
    }

    if (challenge.lockedUntil && challenge.lockedUntil > new Date()) {
      throw new AuthRecoveryServiceError("Too many incorrect codes. Please wait a few minutes and request a new code.", 429);
    }

    let isValidCode = false;

    if (challenge.codeHash === TWILIO_VERIFY_CHALLENGE_SENTINEL) {
      try {
        isValidCode = await recoveryDeliveryService.checkTemporaryLoginCode({
          phoneNumber: challenge.phoneNumberSnapshot,
          code
        });
      } catch (error) {
        if (error instanceof RecoveryDeliveryServiceError) {
          throw new AuthRecoveryServiceError(error.message, 500);
        }

        throw error;
      }
    } else {
      isValidCode = await compare(code.trim(), challenge.codeHash);
    }

    if (!isValidCode) {
      const nextAttemptCount = challenge.attemptCount + 1;
      const now = new Date();
      const shouldConsume = nextAttemptCount >= TEMP_LOGIN_MAX_ATTEMPTS;
      const shouldLock = !shouldConsume && nextAttemptCount >= TEMP_LOGIN_LOCKOUT_THRESHOLD;

      await prisma.temporaryLoginCode.update({
        where: {
          id: challenge.id
        },
        data: {
          attemptCount: nextAttemptCount,
          lastAttemptAt: now,
          lockedUntil: shouldLock ? new Date(now.getTime() + TEMP_LOGIN_LOCKOUT_MS) : null,
          consumedAt: shouldConsume ? now : undefined
        }
      });

      if (shouldConsume) {
        throw new AuthRecoveryServiceError("Too many incorrect codes. Request a new code and try again.", 429);
      }

      if (shouldLock) {
        throw new AuthRecoveryServiceError("Too many incorrect codes. Please wait a few minutes and try again.", 429);
      }

      throw new AuthRecoveryServiceError("Code is incorrect. Try again.", 400);
    }

    await prisma.$transaction([
      prisma.temporaryLoginCode.update({
        where: {
          id: challenge.id
        },
        data: {
          consumedAt: new Date()
        }
      }),
      prisma.temporaryLoginCode.deleteMany({
        where: {
          userId: challenge.user.id,
          id: {
            not: challenge.id
          }
        }
      })
    ]);

    return {
      id: challenge.user.id,
      email: challenge.user.email,
      name: challenge.user.displayName,
      displayName: challenge.user.displayName,
      profileImageUrl: challenge.user.profileImageUrl
    };
  },

  async validatePasswordResetToken(rawToken: string) {
    const tokenHash = hashValue(rawToken);
    const token = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (!token || token.consumedAt || token.expiresAt < new Date()) {
      throw new AuthRecoveryServiceError("This password reset link is invalid or has expired.", 400);
    }

    return {
      email: token.user.email
    };
  },

  async resetPasswordWithToken(rawToken: string, nextPassword: string) {
    if (!rawToken.trim()) {
      throw new AuthRecoveryServiceError("Password reset token is required.", 400);
    }

    validatePassword(nextPassword);

    const tokenHash = hashValue(rawToken);
    const token = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash
      }
    });

    if (!token || token.consumedAt || token.expiresAt < new Date()) {
      throw new AuthRecoveryServiceError("This password reset link is invalid or has expired.", 400);
    }

    const passwordHash = await hash(nextPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: token.userId
        },
        data: {
          passwordHash
        }
      }),
      prisma.passwordResetToken.update({
        where: {
          id: token.id
        },
        data: {
          consumedAt: new Date()
        }
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: token.userId,
          id: {
            not: token.id
          }
        }
      }),
      prisma.temporaryLoginCode.deleteMany({
        where: {
          userId: token.userId
        }
      })
    ]);
  }
};

export { AuthRecoveryServiceError };

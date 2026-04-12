import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPrisma,
  mockGetRecoverySmsMode,
  mockSendPasswordResetEmail,
  mockSendTemporaryLoginCode,
  mockCheckTemporaryLoginCode
} = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    passwordResetToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    temporaryLoginCode: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn(async (operations: unknown[]) => operations)
  },
  mockGetRecoverySmsMode: vi.fn(() => "preview"),
  mockSendPasswordResetEmail: vi.fn(),
  mockSendTemporaryLoginCode: vi.fn(),
  mockCheckTemporaryLoginCode: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/recovery-delivery-service", () => ({
  recoveryDeliveryService: {
    getAppBaseUrl: vi.fn(() => "https://gmfantasy.test"),
    sendPasswordResetEmail: mockSendPasswordResetEmail,
    sendTemporaryLoginCode: mockSendTemporaryLoginCode,
    checkTemporaryLoginCode: mockCheckTemporaryLoginCode
  },
  getRecoverySmsMode: mockGetRecoverySmsMode,
  RecoveryDeliveryServiceError: class RecoveryDeliveryServiceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RecoveryDeliveryServiceError";
    }
  }
}));

import { AuthRecoveryServiceError, authRecoveryService } from "@/server/services/auth-recovery-service";

describe("authRecoveryService.requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecoverySmsMode.mockReturnValue("preview");
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);
  });

  it("creates a reset token without changing token semantics and passes the generated reset link to delivery", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "ben@example.com",
      displayName: "Ben",
      phoneNumber: "(555) 123-4567",
      passwordHash: "hashed"
    });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.passwordResetToken.create.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "token-1",
      ...data
    }));
    mockSendPasswordResetEmail.mockResolvedValueOnce({
      channel: "preview",
      previewResetUrl: "https://gmfantasy.test/reset-password?token=placeholder"
    });

    const result = await authRecoveryService.requestPasswordReset("Ben@example.com");

    expect(mockPrisma.passwordResetToken.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        consumedAt: null,
        expiresAt: {
          gt: expect.any(Date)
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

    const createCall = mockPrisma.passwordResetToken.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe("user-1");
    expect(typeof createCall.data.tokenHash).toBe("string");
    expect(createCall.data.tokenHash).toHaveLength(64);

    const deliveryCall = mockSendPasswordResetEmail.mock.calls[0][0];
    expect(deliveryCall.email).toBe("ben@example.com");
    expect(deliveryCall.resetUrl).toMatch(/^https:\/\/gmfantasy\.test\/reset-password\?token=/);
    expect(deliveryCall.resetUrl).not.toContain(String(createCall.data.tokenHash));

    expect(result.delivery).toEqual({
      channel: "preview",
      previewResetUrl: "https://gmfantasy.test/reset-password?token=placeholder"
    });
  });

  it("throttles repeated password reset requests for the same account", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "ben@example.com",
      displayName: "Ben",
      phoneNumber: "(555) 123-4567",
      passwordHash: "hashed"
    });
    mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
      id: "token-1",
      createdAt: new Date()
    });

    await expect(authRecoveryService.requestPasswordReset("ben@example.com")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "Please wait a moment before requesting another password reset email.",
      statusCode: 429
    });
  });

  it("still rejects when the email is not tied to an account", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(authRecoveryService.requestPasswordReset("missing@example.com")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "That email is not tied to an account.",
      statusCode: 404
    });
  });
});

describe("authRecoveryService temporary login requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "ben@example.com",
        displayName: "Ben",
        phoneNumber: "(555) 123-4567",
        passwordHash: "hashed"
      }
    ]);
    mockPrisma.temporaryLoginCode.findFirst.mockResolvedValue(null);
  });

  it("keeps preview mode using the local preview code flow", async () => {
    mockGetRecoverySmsMode.mockReturnValue("preview");
    mockPrisma.temporaryLoginCode.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.temporaryLoginCode.create.mockResolvedValueOnce({ id: "challenge-1" });
    mockSendTemporaryLoginCode.mockResolvedValueOnce({
      channel: "preview",
      maskedPhoneNumber: "***-***-4567",
      previewCode: "123456"
    });

    const result = await authRecoveryService.createTemporaryLoginCode("5551234567");

    expect(mockSendTemporaryLoginCode).toHaveBeenCalledOnce();
    expect(mockSendTemporaryLoginCode.mock.calls[0][0]).toMatchObject({
      phoneNumber: "(555) 123-4567"
    });
    expect(mockSendTemporaryLoginCode.mock.calls[0][0].code).toMatch(/^\d{6}$/);
    expect(mockPrisma.temporaryLoginCode.create.mock.calls[0][0].data.codeHash).not.toBe("__twilio_verify__");
    expect(result).toEqual({
      challengeId: "challenge-1",
      delivery: {
        channel: "preview",
        maskedPhoneNumber: "***-***-4567",
        previewCode: "123456"
      }
    });
  });

  it("uses Twilio mode without making preview code output the source of truth", async () => {
    mockGetRecoverySmsMode.mockReturnValue("twilio-verify");
    mockPrisma.temporaryLoginCode.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.temporaryLoginCode.create.mockResolvedValueOnce({ id: "challenge-1" });
    mockSendTemporaryLoginCode.mockResolvedValueOnce({
      channel: "sms",
      maskedPhoneNumber: "***-***-4567"
    });

    const result = await authRecoveryService.createTemporaryLoginCode("(555) 123-4567");

    expect(mockSendTemporaryLoginCode).toHaveBeenCalledWith({
      phoneNumber: "(555) 123-4567"
    });
    expect(mockPrisma.temporaryLoginCode.create.mock.calls[0][0].data.codeHash).toBe("__twilio_verify__");
    expect(result).toEqual({
      challengeId: "challenge-1",
      delivery: {
        channel: "sms",
        maskedPhoneNumber: "***-***-4567"
      }
    });
  });

  it("throttles repeated temporary login code requests for the same account", async () => {
    mockGetRecoverySmsMode.mockReturnValue("twilio-verify");
    mockPrisma.temporaryLoginCode.findFirst.mockResolvedValueOnce({
      id: "challenge-1",
      createdAt: new Date()
    });

    await expect(authRecoveryService.createTemporaryLoginCode("(555) 123-4567")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "Please wait a moment before requesting another login code.",
      statusCode: 429
    });
  });
});

describe("authRecoveryService temporary login verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies a Twilio-backed challenge against the correct phone snapshot and returns the mapped user", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
      attemptCount: 0,
      lastAttemptAt: null,
      lockedUntil: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "ben@example.com",
        displayName: "Ben"
      }
    });
    mockCheckTemporaryLoginCode.mockResolvedValueOnce(true);

    const result = await authRecoveryService.verifyTemporaryLoginCode("challenge-1", "123456");

    expect(mockCheckTemporaryLoginCode).toHaveBeenCalledWith({
      phoneNumber: "(555) 123-4567",
      code: "123456"
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(result).toEqual({
      id: "user-1",
      email: "ben@example.com",
      name: "Ben",
      displayName: "Ben"
    });
  });

  it("rejects expired challenges safely", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
      attemptCount: 0,
      lastAttemptAt: null,
      lockedUntil: null,
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "ben@example.com",
        displayName: "Ben"
      }
    });

    await expect(authRecoveryService.verifyTemporaryLoginCode("challenge-1", "123456")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "That temporary login code has expired. Request a new code and try again.",
      statusCode: 400
    });
  });

  it("prevents challenge reuse after successful verification", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
      attemptCount: 0,
      lastAttemptAt: null,
      lockedUntil: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: new Date(),
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "ben@example.com",
        displayName: "Ben"
      }
    });

    await expect(authRecoveryService.verifyTemporaryLoginCode("challenge-1", "123456")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "That temporary login code has expired. Request a new code and try again.",
      statusCode: 400
    });
  });

  it("locks a challenge after repeated invalid attempts", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
      attemptCount: 2,
      lastAttemptAt: null,
      lockedUntil: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "ben@example.com",
        displayName: "Ben"
      }
    });
    mockCheckTemporaryLoginCode.mockResolvedValueOnce(false);
    mockPrisma.temporaryLoginCode.update.mockResolvedValueOnce({});

    await expect(authRecoveryService.verifyTemporaryLoginCode("challenge-1", "999999")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "Too many incorrect codes. Please wait a few minutes and try again.",
      statusCode: 429
    });

    expect(mockPrisma.temporaryLoginCode.update).toHaveBeenCalledWith({
      where: {
        id: "challenge-1"
      },
      data: {
        attemptCount: 3,
        lastAttemptAt: expect.any(Date),
        lockedUntil: expect.any(Date),
        consumedAt: undefined
      }
    });
  });

  it("invalidates a challenge after too many invalid attempts", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
      attemptCount: 4,
      lastAttemptAt: null,
      lockedUntil: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "ben@example.com",
        displayName: "Ben"
      }
    });
    mockCheckTemporaryLoginCode.mockResolvedValueOnce(false);
    mockPrisma.temporaryLoginCode.update.mockResolvedValueOnce({});

    await expect(authRecoveryService.verifyTemporaryLoginCode("challenge-1", "999999")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "Too many incorrect codes. Request a new code and try again.",
      statusCode: 429
    });

    expect(mockPrisma.temporaryLoginCode.update).toHaveBeenCalledWith({
      where: {
        id: "challenge-1"
      },
      data: {
        attemptCount: 5,
        lastAttemptAt: expect.any(Date),
        lockedUntil: null,
        consumedAt: expect.any(Date)
      }
    });
  });

  it("blocks verification while a challenge is locked", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
      attemptCount: 3,
      lastAttemptAt: new Date(),
      lockedUntil: new Date(Date.now() + 60 * 1000),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "ben@example.com",
        displayName: "Ben"
      }
    });

    await expect(authRecoveryService.verifyTemporaryLoginCode("challenge-1", "123456")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "Too many incorrect codes. Please wait a few minutes and request a new code.",
      statusCode: 429
    });
  });
});

describe("authRecoveryService password reset completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the token consumed and clears sibling reset and temporary-login challenges", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: "token-1",
      userId: "user-1",
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null
    });

    await authRecoveryService.resetPasswordWithToken("raw-token", "new-password-123");

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    const operations = mockPrisma.$transaction.mock.calls[0][0];
    expect(operations).toHaveLength(4);
  });

  it("rejects reused password reset tokens", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: "token-1",
      userId: "user-1",
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: new Date()
    });

    await expect(authRecoveryService.resetPasswordWithToken("raw-token", "new-password-123")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "This password reset link is invalid or has expired.",
      statusCode: 400
    });
  });

  it("keeps repeated token validation deterministic for active tokens", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      user: {
        email: "ben@example.com"
      }
    });

    await expect(authRecoveryService.validatePasswordResetToken("raw-token")).resolves.toEqual({
      email: "ben@example.com"
    });
    await expect(authRecoveryService.validatePasswordResetToken("raw-token")).resolves.toEqual({
      email: "ben@example.com"
    });
  });
});

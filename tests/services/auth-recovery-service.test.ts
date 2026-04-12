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
      findMany: vi.fn()
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    temporaryLoginCode: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
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

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: "ben@example.com"
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        phoneNumber: true,
        passwordHash: true
      }
    });
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1"
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

  it("still rejects when the email is not tied to an account", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(authRecoveryService.requestPasswordReset("missing@example.com")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "That email is not tied to an account.",
      statusCode: 404
    });
  });
});

describe("authRecoveryService temporary login", () => {
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

  it("verifies a Twilio-backed challenge against the correct phone snapshot and returns the mapped user", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
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
    mockPrisma.temporaryLoginCode.update.mockResolvedValueOnce({});

    const result = await authRecoveryService.verifyTemporaryLoginCode("challenge-1", "123456");

    expect(mockCheckTemporaryLoginCode).toHaveBeenCalledWith({
      phoneNumber: "(555) 123-4567",
      code: "123456"
    });
    expect(mockPrisma.temporaryLoginCode.update).toHaveBeenCalledWith({
      where: {
        id: "challenge-1"
      },
      data: {
        consumedAt: expect.any(Date)
      }
    });
    expect(result).toEqual({
      id: "user-1",
      email: "ben@example.com",
      name: "Ben",
      displayName: "Ben"
    });
  });

  it("rejects an incorrect Twilio-backed code cleanly", async () => {
    mockPrisma.temporaryLoginCode.findUnique.mockResolvedValueOnce({
      id: "challenge-1",
      userId: "user-1",
      codeHash: "__twilio_verify__",
      phoneNumberSnapshot: "(555) 123-4567",
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

    await expect(authRecoveryService.verifyTemporaryLoginCode("challenge-1", "999999")).rejects.toMatchObject<AuthRecoveryServiceError>({
      message: "Code is incorrect. Try again.",
      statusCode: 400
    });
  });
});

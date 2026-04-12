import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockSendPasswordResetEmail } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn()
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn()
    }
  },
  mockSendPasswordResetEmail: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/recovery-delivery-service", () => ({
  recoveryDeliveryService: {
    getAppBaseUrl: vi.fn(() => "https://gmfantasy.test"),
    sendPasswordResetEmail: mockSendPasswordResetEmail
  },
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

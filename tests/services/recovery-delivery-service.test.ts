import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEmailSend, mockResendConstructor } = vi.hoisted(() => ({
  mockEmailSend: vi.fn(),
  mockResendConstructor: vi.fn()
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: mockEmailSend
    };

    constructor(apiKey: string) {
      mockResendConstructor(apiKey);
    }
  }
}));

import { RecoveryDeliveryServiceError, recoveryDeliveryService } from "@/server/services/recovery-delivery-service";

describe("recoveryDeliveryService.sendPasswordResetEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test"
    };
  });

  it("returns a preview link in preview mode", async () => {
    process.env.AUTH_RECOVERY_EMAIL_MODE = "preview";

    await expect(
      recoveryDeliveryService.sendPasswordResetEmail({
        email: "ben@example.com",
        resetUrl: "http://localhost:3000/reset-password?token=abc"
      })
    ).resolves.toEqual({
      channel: "preview",
      previewResetUrl: "http://localhost:3000/reset-password?token=abc"
    });

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it("requires resend config in resend mode", async () => {
    process.env.AUTH_RECOVERY_EMAIL_MODE = "resend";
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_FROM_EMAIL;

    await expect(
      recoveryDeliveryService.sendPasswordResetEmail({
        email: "ben@example.com",
        resetUrl: "http://localhost:3000/reset-password?token=abc"
      })
    ).rejects.toMatchObject<RecoveryDeliveryServiceError>({
      message: "RESEND_API_KEY is required when AUTH_RECOVERY_EMAIL_MODE=resend."
    });
  });

  it("uses resend deterministically in resend mode and sends the generated reset link", async () => {
    process.env.AUTH_RECOVERY_EMAIL_MODE = "resend";
    process.env.RESEND_API_KEY = "resend_test_key";
    process.env.AUTH_FROM_EMAIL = "no-reply@gmfantasy.test";
    mockEmailSend.mockResolvedValueOnce({ data: { id: "email-1" }, error: null });

    await expect(
      recoveryDeliveryService.sendPasswordResetEmail({
        email: "ben@example.com",
        resetUrl: "https://gmfantasy.test/reset-password?token=secure-token"
      })
    ).resolves.toEqual({
      channel: "email"
    });

    expect(mockResendConstructor).toHaveBeenCalledWith("resend_test_key");
    expect(mockEmailSend).toHaveBeenCalledOnce();
    expect(mockEmailSend.mock.calls[0][0]).toMatchObject({
      from: "no-reply@gmfantasy.test",
      to: "ben@example.com",
      subject: "GM Fantasy Password Reset"
    });
    expect(mockEmailSend.mock.calls[0][0].html).toContain("https://gmfantasy.test/reset-password?token=secure-token");
    expect(mockEmailSend.mock.calls[0][0].text).toContain("https://gmfantasy.test/reset-password?token=secure-token");
  });

  it("blocks preview mode in production so preview links are not surfaced accidentally", async () => {
    process.env.AUTH_RECOVERY_EMAIL_MODE = "preview";
    process.env.NODE_ENV = "production";

    await expect(
      recoveryDeliveryService.sendPasswordResetEmail({
        email: "ben@example.com",
        resetUrl: "https://gmfantasy.test/reset-password?token=abc"
      })
    ).rejects.toMatchObject<RecoveryDeliveryServiceError>({
      message: "Preview password recovery email mode is disabled in production. Set AUTH_RECOVERY_EMAIL_MODE=resend."
    });
  });
});

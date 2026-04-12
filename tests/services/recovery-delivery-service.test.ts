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

describe("recoveryDeliveryService", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test"
    };
    global.fetch = mockFetch as typeof fetch;
  });

  describe("sendPasswordResetEmail", () => {
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

  describe("sendTemporaryLoginCode", () => {
    it("returns a preview code in preview mode", async () => {
      process.env.AUTH_RECOVERY_SMS_MODE = "preview";

      await expect(
        recoveryDeliveryService.sendTemporaryLoginCode({
          phoneNumber: "(555) 123-4567",
          code: "123456"
        })
      ).resolves.toEqual({
        channel: "preview",
        maskedPhoneNumber: "***-***-4567",
        previewCode: "123456"
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("requires Twilio config in twilio-verify mode", async () => {
      process.env.AUTH_RECOVERY_SMS_MODE = "twilio-verify";
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_VERIFY_SERVICE_SID;

      await expect(
        recoveryDeliveryService.sendTemporaryLoginCode({
          phoneNumber: "(555) 123-4567"
        })
      ).rejects.toMatchObject<RecoveryDeliveryServiceError>({
        message: "TWILIO_ACCOUNT_SID is required when AUTH_RECOVERY_SMS_MODE=twilio-verify."
      });
    });

    it("uses Twilio Verify in twilio-verify mode without surfacing preview codes", async () => {
      process.env.AUTH_RECOVERY_SMS_MODE = "twilio-verify";
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "twilio-token";
      process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ sid: "VE123", status: "pending" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

      await expect(
        recoveryDeliveryService.sendTemporaryLoginCode({
          phoneNumber: "(555) 123-4567"
        })
      ).resolves.toEqual({
        channel: "sms",
        maskedPhoneNumber: "***-***-4567"
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toBe("https://verify.twilio.com/v2/Services/VA123/Verifications");
      expect(mockFetch.mock.calls[0][1]).toMatchObject({
        method: "POST"
      });
      expect(String(mockFetch.mock.calls[0][1]?.headers?.Authorization)).toMatch(/^Basic /);
      expect(String(mockFetch.mock.calls[0][1]?.body)).toContain("To=%2B15551234567");
      expect(String(mockFetch.mock.calls[0][1]?.body)).toContain("Channel=sms");
    });

    it("blocks preview SMS mode in production so preview codes are not surfaced accidentally", async () => {
      process.env.AUTH_RECOVERY_SMS_MODE = "preview";
      process.env.NODE_ENV = "production";

      await expect(
        recoveryDeliveryService.sendTemporaryLoginCode({
          phoneNumber: "(555) 123-4567",
          code: "123456"
        })
      ).rejects.toMatchObject<RecoveryDeliveryServiceError>({
        message: "Preview phone verification SMS mode is disabled in production. Set AUTH_RECOVERY_SMS_MODE=twilio-verify."
      });
    });
  });

  describe("checkTemporaryLoginCode", () => {
    it("uses Twilio Verify check in twilio-verify mode", async () => {
      process.env.AUTH_RECOVERY_SMS_MODE = "twilio-verify";
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "twilio-token";
      process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "approved" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

      await expect(
        recoveryDeliveryService.checkTemporaryLoginCode({
          phoneNumber: "(555) 123-4567",
          code: "123456"
        })
      ).resolves.toBe(true);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toBe("https://verify.twilio.com/v2/Services/VA123/VerificationCheck");
      expect(String(mockFetch.mock.calls[0][1]?.body)).toContain("Code=123456");
    });

    it("returns false when Twilio Verify does not approve the code", async () => {
      process.env.AUTH_RECOVERY_SMS_MODE = "twilio-verify";
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "twilio-token";
      process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

      await expect(
        recoveryDeliveryService.checkTemporaryLoginCode({
          phoneNumber: "(555) 123-4567",
          code: "999999"
        })
      ).resolves.toBe(false);
    });
  });

  it("restores global fetch after this suite", () => {
    global.fetch = originalFetch;
  });
});

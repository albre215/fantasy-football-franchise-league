import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequestPasswordReset } = vi.hoisted(() => ({
  mockRequestPasswordReset: vi.fn()
}));

vi.mock("@/server/services/auth-recovery-service", () => ({
  authRecoveryService: {
    requestPasswordReset: mockRequestPasswordReset
  },
  AuthRecoveryServiceError: class AuthRecoveryServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "AuthRecoveryServiceError";
      this.statusCode = statusCode;
    }
  }
}));

import { POST } from "@/app/api/auth/recovery/password/request/route";

describe("POST /api/auth/recovery/password/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a neutral success response when the email is not tied to an account", async () => {
    const { AuthRecoveryServiceError } = await import("@/server/services/auth-recovery-service");
    mockRequestPasswordReset.mockRejectedValueOnce(new AuthRecoveryServiceError("That email is not tied to an account.", 404));

    const response = await POST(
      new Request("http://localhost:3000/api/auth/recovery/password/request", {
        method: "POST",
        body: JSON.stringify({
          email: "missing@example.com"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "If an account matches that email, a password reset email will be sent.",
      delivery: {
        channel: "email"
      }
    });
  });

  it("returns a neutral success response when the request is throttled", async () => {
    const { AuthRecoveryServiceError } = await import("@/server/services/auth-recovery-service");
    mockRequestPasswordReset.mockRejectedValueOnce(
      new AuthRecoveryServiceError("Please wait a moment before requesting another password reset email.", 429)
    );

    const response = await POST(
      new Request("http://localhost:3000/api/auth/recovery/password/request", {
        method: "POST",
        body: JSON.stringify({
          email: "ben@example.com"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "If an account matches that email, a password reset email will be sent.",
      delivery: {
        channel: "email"
      }
    });
  });
});

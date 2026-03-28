import { compare } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

import { AuthServiceError, authService } from "@/server/services/auth-service";

describe("authService.registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user with a hashed password", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockImplementationOnce(async ({ data }: { data: Record<string, string> }) => ({
      id: "user-1",
      email: data.email,
      displayName: data.displayName,
      passwordHash: data.passwordHash
    }));

    const user = await authService.registerUser({
      displayName: "Ben Albrecht",
      email: "Ben@example.com",
      password: "safe-password"
    });

    expect(user).toEqual({
      id: "user-1",
      email: "ben@example.com",
      displayName: "Ben Albrecht"
    });

    const createArg = mockPrisma.user.create.mock.calls[0][0];
    expect(createArg.data.passwordHash).not.toBe("safe-password");
    await expect(compare("safe-password", createArg.data.passwordHash)).resolves.toBe(true);
  });

  it("allows claiming a placeholder user that is unclaimed and already linked to league membership", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "placeholder-user",
      email: "ben@example.com",
      displayName: "Placeholder",
      passwordHash: null,
      leagueMembers: [{ id: "member-1" }]
    });
    mockPrisma.user.update.mockImplementationOnce(
      async ({ where, data }: { where: { id: string }; data: Record<string, string> }) => ({
        id: where.id,
        email: "ben@example.com",
        displayName: data.displayName,
        passwordHash: data.passwordHash
      })
    );

    const user = await authService.registerUser({
      displayName: "Ben Albrecht",
      email: "ben@example.com",
      password: "safe-password"
    });

    expect(user.id).toBe("placeholder-user");
    expect(mockPrisma.user.update).toHaveBeenCalledOnce();
  });

  it("rejects registering over an already claimed account", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "claimed-user",
      email: "ben@example.com",
      displayName: "Ben",
      passwordHash: "hashed-password",
      leagueMembers: [{ id: "member-1" }]
    });

    await expect(
      authService.registerUser({
        displayName: "Ben Albrecht",
        email: "ben@example.com",
        password: "safe-password"
      })
    ).rejects.toMatchObject<AuthServiceError>({
      message: "An account with that email already exists.",
      statusCode: 409
    });

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects invalid claim state for orphaned existing users", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "orphan-user",
      email: "ben@example.com",
      displayName: "Orphan",
      passwordHash: null,
      leagueMembers: []
    });

    await expect(
      authService.registerUser({
        displayName: "Ben Albrecht",
        email: "ben@example.com",
        password: "safe-password"
      })
    ).rejects.toMatchObject<AuthServiceError>({
      message:
        "This email cannot be claimed automatically. Ask the commissioner to re-add the member or use a different email.",
      statusCode: 409
    });
  });

  it("rejects passwords that exceed bcrypt's safe byte limit", async () => {
    await expect(
      authService.registerUser({
        displayName: "Ben Albrecht",
        email: "ben@example.com",
        password: "a".repeat(73)
      })
    ).rejects.toMatchObject<AuthServiceError>({
      message: "Password must be 72 bytes or fewer to avoid bcrypt truncation.",
      statusCode: 400
    });
  });
});

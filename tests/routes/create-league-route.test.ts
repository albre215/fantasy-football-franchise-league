import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthenticatedUserId, createLeague, MockRouteAuthError, MockLeagueServiceError } = vi.hoisted(
  () => ({
  requireAuthenticatedUserId: vi.fn(),
  createLeague: vi.fn(),
  MockRouteAuthError: class extends Error {
    constructor(
      message: string,
      public readonly statusCode: number
    ) {
      super(message);
      this.name = "RouteAuthError";
    }
  },
  MockLeagueServiceError: class extends Error {
    constructor(
      message: string,
      public readonly statusCode: number
    ) {
      super(message);
      this.name = "LeagueServiceError";
    }
  }
})
);

vi.mock("@/lib/auth-session", () => ({
  requireAuthenticatedUserId,
  RouteAuthError: MockRouteAuthError
}));

vi.mock("@/server/services/league-service", () => ({
  leagueService: {
    createLeague
  },
  LeagueServiceError: MockLeagueServiceError
}));

import { POST } from "@/app/api/league/create/route";

describe("POST /api/league/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    requireAuthenticatedUserId.mockRejectedValueOnce(
      new MockRouteAuthError("Authentication is required.", 401)
    );

    const response = await POST(
      new Request("http://localhost:3000/api/league/create", {
        method: "POST",
        body: JSON.stringify({
          name: "Test League"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication is required."
    });
    expect(createLeague).not.toHaveBeenCalled();
  });

  it("uses the session user id instead of trusting client-provided identity", async () => {
    requireAuthenticatedUserId.mockResolvedValueOnce("session-user-id");
    createLeague.mockResolvedValueOnce({
      id: "league-1",
      name: "Test League",
      slug: "test-league",
      description: null,
      createdAt: new Date().toISOString(),
      members: [],
      seasons: []
    });

    const response = await POST(
      new Request("http://localhost:3000/api/league/create", {
        method: "POST",
        body: JSON.stringify({
          name: "Test League",
          description: "Testing",
          userId: "attacker-controlled-user-id"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    expect(response.status).toBe(201);
    expect(createLeague).toHaveBeenCalledWith({
      userId: "session-user-id",
      name: "Test League",
      description: "Testing"
    });
  });
});

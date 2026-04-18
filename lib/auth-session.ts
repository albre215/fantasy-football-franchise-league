import { getServerAuthSession } from "@/auth";

class RouteAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "RouteAuthError";
  }
}

async function getAuthenticatedSessionUser() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    throw new RouteAuthError("Authentication is required.", 401);
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    displayName: session.user.displayName ?? session.user.name ?? ""
  };
}

export async function requireAuthenticatedUser() {
  return getAuthenticatedSessionUser();
}

export async function requireAuthenticatedUserId() {
  const user = await getAuthenticatedSessionUser();
  return user.id;
}

export { RouteAuthError };

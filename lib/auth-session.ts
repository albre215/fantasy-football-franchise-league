import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      id: true,
      email: true,
      displayName: true
    }
  });

  if (!user) {
    throw new RouteAuthError("Authenticated user not found.", 401);
  }

  return user;
}

export async function requireAuthenticatedUser() {
  return getAuthenticatedSessionUser();
}

export async function requireAuthenticatedUserId() {
  const user = await getAuthenticatedSessionUser();
  return user.id;
}

export { RouteAuthError };

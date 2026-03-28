import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

interface RegisterUserInput {
  displayName: string;
  email: string;
  password: string;
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw new AuthServiceError("Password must be at least 8 characters long.", 400);
  }
}

export const authService = {
  async registerUser(input: RegisterUserInput) {
    const displayName = input.displayName.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!displayName || !email || !password) {
      throw new AuthServiceError("displayName, email, and password are required.", 400);
    }

    validatePassword(password);

    const passwordHash = await hash(password, 12);
    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (existingUser?.passwordHash) {
      throw new AuthServiceError("An account with that email already exists.", 409);
    }

    const user = existingUser
      ? await prisma.user.update({
          where: {
            id: existingUser.id
          },
          data: {
            displayName,
            passwordHash
          }
        })
      : await prisma.user.create({
          data: {
            email,
            displayName,
            passwordHash
          }
        });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName
    };
  }
};

export { AuthServiceError };

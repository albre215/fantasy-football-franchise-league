import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL_LENGTH = 320;
const MAX_DISPLAY_NAME_LENGTH = 100;

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
  phoneNumber?: string;
  password: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.trim();
}

function validateEmail(email: string) {
  if (!email) {
    throw new AuthServiceError("Email is required.", 400);
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw new AuthServiceError("Email is too long.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthServiceError("Enter a valid email address.", 400);
  }
}

function validateDisplayName(displayName: string) {
  if (!displayName) {
    throw new AuthServiceError("Display name is required.", 400);
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new AuthServiceError("Display name is too long.", 400);
  }
}

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthServiceError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, 400);
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new AuthServiceError(
      `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer to avoid bcrypt truncation.`,
      400
    );
  }
}

function validatePhoneNumber(phoneNumber: string) {
  if (!phoneNumber) {
    return;
  }

  if (phoneNumber.length > 25) {
    throw new AuthServiceError("Phone number is too long.", 400);
  }

  if (!/^[0-9()+\-\s]{7,25}$/.test(phoneNumber)) {
    throw new AuthServiceError("Enter a valid phone number.", 400);
  }
}

function isClaimablePlaceholderUser(user: {
  passwordHash: string | null;
  leagueMembers: Array<{ id: string }>;
}) {
  return user.passwordHash === null && user.leagueMembers.length > 0;
}

async function getExistingUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      passwordHash: true,
      leagueMembers: {
        select: {
          id: true
        },
        take: 1
      }
    }
  });
}

function getExistingUserRegistrationError(existingUser: {
  passwordHash: string | null;
  leagueMembers: Array<{ id: string }>;
}) {
  if (existingUser.passwordHash) {
    return new AuthServiceError("An account with that email already exists.", 409);
  }

  return new AuthServiceError(
    "This email cannot be claimed automatically. Ask the commissioner to re-add the member or use a different email.",
    409
  );
}

export const authService = {
  async registerUser(input: RegisterUserInput) {
    const displayName = input.displayName.trim();
    const email = normalizeEmail(input.email);
    const phoneNumber = normalizePhoneNumber(input.phoneNumber ?? "");
    const password = input.password;

    if (!password) {
      throw new AuthServiceError("Password is required.", 400);
    }

    validateDisplayName(displayName);
    validateEmail(email);
    validatePhoneNumber(phoneNumber);
    validatePassword(password);

    const passwordHash = await hash(password, 12);
    const existingUser = await getExistingUserByEmail(email);

    if (existingUser && !isClaimablePlaceholderUser(existingUser)) {
      throw getExistingUserRegistrationError(existingUser);
    }

    const user = existingUser
      ? await prisma.user.update({
          where: {
            id: existingUser.id
          },
          data: {
            displayName,
            phoneNumber: phoneNumber || null,
            passwordHash
          }
        })
      : await prisma.user.create({
          data: {
            email,
            displayName,
            phoneNumber: phoneNumber || null,
            passwordHash
          }
        });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber
    };
  }
};

export { AuthServiceError };

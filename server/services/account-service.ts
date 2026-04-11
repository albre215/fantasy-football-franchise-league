import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import type { AccountProfile, UpdateAccountProfileInput } from "@/types/account";

const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 320;
const MAX_PROFILE_IMAGE_URL_LENGTH = 400_000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

class AccountServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "AccountServiceError";
  }
}

function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.trim();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateDisplayName(displayName: string) {
  if (!displayName) {
    throw new AccountServiceError("Display name is required.", 400);
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new AccountServiceError("Display name is too long.", 400);
  }
}

function validatePhoneNumber(phoneNumber: string) {
  if (!phoneNumber) {
    return;
  }

  if (phoneNumber.length > 25) {
    throw new AccountServiceError("Phone number is too long.", 400);
  }

  if (!/^[0-9()+\-\s]{7,25}$/.test(phoneNumber)) {
    throw new AccountServiceError("Enter a valid phone number.", 400);
  }
}

function validateEmail(email: string) {
  if (!email) {
    throw new AccountServiceError("Email is required.", 400);
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw new AccountServiceError("Email is too long.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountServiceError("Enter a valid email address.", 400);
  }
}

function validatePassword(password: string) {
  if (!password) {
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AccountServiceError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, 400);
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new AccountServiceError(
      `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer to avoid bcrypt truncation.`,
      400
    );
  }
}

function validateProfileImageUrl(profileImageUrl: string | null) {
  if (!profileImageUrl) {
    return;
  }

  if (profileImageUrl.length > MAX_PROFILE_IMAGE_URL_LENGTH) {
    throw new AccountServiceError("Profile image is too large.", 400);
  }

  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(profileImageUrl)) {
    throw new AccountServiceError("Profile image must be a PNG, JPEG, or WebP data URL.", 400);
  }
}

function mapAccountProfile(user: {
  id: string;
  displayName: string;
  email: string;
  phoneNumber: string | null;
  profileImageUrl: string | null;
}): AccountProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    profileImageUrl: user.profileImageUrl
  };
}

export const accountService = {
  async getAccountProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        profileImageUrl: true
      }
    });

    if (!user) {
      throw new AccountServiceError("Authenticated user not found.", 404);
    }

    return mapAccountProfile(user);
  },

  async updateAccountProfile(userId: string, input: UpdateAccountProfileInput) {
    const displayName = input.displayName.trim();
    const email = normalizeEmail(input.email);
    const phoneNumber = normalizePhoneNumber(input.phoneNumber ?? "");
    const password = input.password?.trim() ?? "";
    const profileImageUrl = input.profileImageUrl?.trim() ? input.profileImageUrl.trim() : null;

    validateDisplayName(displayName);
    validateEmail(email);
    validatePhoneNumber(phoneNumber);
    validatePassword(password);
    validateProfileImageUrl(profileImageUrl);

    const passwordHash = password ? await hash(password, 12) : undefined;

    try {
      const user = await prisma.user.update({
        where: {
          id: userId
        },
        data: {
          displayName,
          email,
          phoneNumber: phoneNumber || null,
          ...(passwordHash ? { passwordHash } : {}),
          profileImageUrl
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          phoneNumber: true,
          profileImageUrl: true
        }
      });

      return mapAccountProfile(user);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new AccountServiceError("That email address is already in use.", 409);
      }

      throw error;
    }
  },

  async changePassword(userId: string, currentPassword: string, nextPassword: string) {
    const normalizedCurrentPassword = currentPassword;
    const normalizedNextPassword = nextPassword;

    if (!normalizedCurrentPassword) {
      throw new AccountServiceError("Current password is required.", 400);
    }

    validatePassword(normalizedNextPassword);

    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        passwordHash: true
      }
    });

    if (!user?.passwordHash) {
      throw new AccountServiceError("Password reset is unavailable for this account.", 400);
    }

    const isValidPassword = await compare(normalizedCurrentPassword, user.passwordHash);

    if (!isValidPassword) {
      throw new AccountServiceError("Current password is incorrect.", 400);
    }

    const passwordHash = await hash(normalizedNextPassword, 12);

    await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        passwordHash
      }
    });
  }
};

export { AccountServiceError };

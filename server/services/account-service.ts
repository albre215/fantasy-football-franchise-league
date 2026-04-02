import { prisma } from "@/lib/prisma";
import type { AccountProfile, UpdateAccountProfileInput } from "@/types/account";

const MAX_DISPLAY_NAME_LENGTH = 100;

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

function mapAccountProfile(user: {
  id: string;
  displayName: string;
  email: string;
  phoneNumber: string | null;
}): AccountProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber
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
        phoneNumber: true
      }
    });

    if (!user) {
      throw new AccountServiceError("Authenticated user not found.", 404);
    }

    return mapAccountProfile(user);
  },

  async updateAccountProfile(userId: string, input: UpdateAccountProfileInput) {
    const displayName = input.displayName.trim();
    const phoneNumber = normalizePhoneNumber(input.phoneNumber ?? "");

    validateDisplayName(displayName);
    validatePhoneNumber(phoneNumber);

    const user = await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        displayName,
        phoneNumber: phoneNumber || null
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true
      }
    });

    return mapAccountProfile(user);
  }
};

export { AccountServiceError };

import { prisma } from "@/lib/prisma";
import type { AccountProfile, UpdateAccountProfileInput } from "@/types/account";

const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_PROFILE_IMAGE_URL_LENGTH = 400_000;

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
    const phoneNumber = normalizePhoneNumber(input.phoneNumber ?? "");
    const profileImageUrl = input.profileImageUrl?.trim() ? input.profileImageUrl.trim() : null;

    validateDisplayName(displayName);
    validatePhoneNumber(phoneNumber);
    validateProfileImageUrl(profileImageUrl);

    const user = await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        displayName,
        phoneNumber: phoneNumber || null,
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
  }
};

export { AccountServiceError };

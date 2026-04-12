function maskPhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length < 4) {
    return phoneNumber;
  }

  return `***-***-${digits.slice(-4)}`;
}

type PasswordResetDeliveryResult =
  | {
      channel: "email";
      previewResetUrl?: undefined;
    }
  | {
      channel: "preview";
      previewResetUrl: string;
    };

type TemporaryLoginDeliveryResult =
  | {
      channel: "sms";
      maskedPhoneNumber: string;
      previewCode?: undefined;
    }
  | {
      channel: "preview";
      maskedPhoneNumber: string;
      previewCode: string;
    };

export const recoveryDeliveryService = {
  async sendPasswordResetEmail({
    email,
    resetUrl
  }: {
    email: string;
    resetUrl: string;
  }): Promise<PasswordResetDeliveryResult> {
    const mode = process.env.AUTH_RECOVERY_EMAIL_MODE?.trim().toLowerCase() ?? "preview";

    if (mode === "preview") {
      return {
        channel: "preview",
        previewResetUrl: resetUrl
      };
    }

    console.info(`[auth-recovery] Password reset email requested for ${email}. No email provider is configured, using preview fallback.`);

    return {
      channel: "preview",
      previewResetUrl: resetUrl
    };
  },

  async sendTemporaryLoginCode({
    phoneNumber,
    code
  }: {
    phoneNumber: string;
    code: string;
  }): Promise<TemporaryLoginDeliveryResult> {
    const mode = process.env.AUTH_RECOVERY_SMS_MODE?.trim().toLowerCase() ?? "preview";
    const maskedPhoneNumber = maskPhoneNumber(phoneNumber);

    if (mode === "preview") {
      return {
        channel: "preview",
        maskedPhoneNumber,
        previewCode: code
      };
    }

    console.info(`[auth-recovery] Temporary login code requested for ${maskedPhoneNumber}. No SMS provider is configured, using preview fallback.`);

    return {
      channel: "preview",
      maskedPhoneNumber,
      previewCode: code
    };
  }
};

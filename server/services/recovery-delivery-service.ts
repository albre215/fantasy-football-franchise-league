import { Resend } from "resend";

function maskPhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length < 4) {
    return phoneNumber;
  }

  return `***-***-${digits.slice(-4)}`;
}

function normalizeMode(value: string | undefined, fallback: string) {
  return value?.trim().toLowerCase() || fallback;
}

function getAppBaseUrl() {
  return process.env.AUTH_APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
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

class RecoveryDeliveryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryDeliveryServiceError";
  }
}

function getRecoveryEmailMode() {
  const mode = normalizeMode(process.env.AUTH_RECOVERY_EMAIL_MODE, "preview");

  if (mode !== "preview" && mode !== "resend") {
    throw new RecoveryDeliveryServiceError("AUTH_RECOVERY_EMAIL_MODE must be either 'preview' or 'resend'.");
  }

  return mode;
}

function getRecoverySmsMode() {
  return normalizeMode(process.env.AUTH_RECOVERY_SMS_MODE, "preview");
}

function assertPreviewModeIsSafe(mode: string) {
  if (mode === "preview" && isProductionEnvironment()) {
    throw new RecoveryDeliveryServiceError(
      "Preview password recovery email mode is disabled in production. Set AUTH_RECOVERY_EMAIL_MODE=resend."
    );
  }
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.AUTH_FROM_EMAIL?.trim();

  if (!apiKey) {
    throw new RecoveryDeliveryServiceError("RESEND_API_KEY is required when AUTH_RECOVERY_EMAIL_MODE=resend.");
  }

  if (!fromEmail) {
    throw new RecoveryDeliveryServiceError("AUTH_FROM_EMAIL is required when AUTH_RECOVERY_EMAIL_MODE=resend.");
  }

  return {
    apiKey,
    fromEmail
  };
}

function buildPasswordResetEmail({
  resetUrl
}: {
  resetUrl: string;
}) {
  return {
    subject: "GM Fantasy Password Reset",
    text: [
      "We received a request to reset your GM Fantasy password.",
      "",
      "Use the link below to create a new password:",
      resetUrl,
      "",
      "If you did not request this, you can safely ignore this email."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #163321; line-height: 1.5;">
        <p>We received a request to reset your GM Fantasy password.</p>
        <p>
          <a href="${resetUrl}" style="color: #1846d1;">Reset your password</a>
        </p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `
  };
}

async function sendPasswordResetEmailWithResend({
  email,
  resetUrl
}: {
  email: string;
  resetUrl: string;
}) {
  const { apiKey, fromEmail } = getResendConfig();
  const resend = new Resend(apiKey);
  const message = buildPasswordResetEmail({ resetUrl });

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    if (response.error) {
      throw new Error(response.error.message);
    }
  } catch {
    throw new RecoveryDeliveryServiceError("Unable to send the password reset email right now. Please try again.");
  }
}

export const recoveryDeliveryService = {
  getAppBaseUrl,

  async sendPasswordResetEmail({
    email,
    resetUrl
  }: {
    email: string;
    resetUrl: string;
  }): Promise<PasswordResetDeliveryResult> {
    const mode = getRecoveryEmailMode();

    if (mode === "preview") {
      assertPreviewModeIsSafe(mode);

      return {
        channel: "preview",
        previewResetUrl: resetUrl
      };
    }

    await sendPasswordResetEmailWithResend({
      email,
      resetUrl
    });

    return {
      channel: "email"
    };
  },

  async sendTemporaryLoginCode({
    phoneNumber,
    code
  }: {
    phoneNumber: string;
    code: string;
  }): Promise<TemporaryLoginDeliveryResult> {
    const mode = getRecoverySmsMode();
    const maskedPhoneNumber = maskPhoneNumber(phoneNumber);

    if (mode === "preview") {
      return {
        channel: "preview",
        maskedPhoneNumber,
        previewCode: code
      };
    }

    console.info(
      `[auth-recovery] Temporary login code requested for ${maskedPhoneNumber}. No SMS provider is configured, using preview fallback.`
    );

    return {
      channel: "preview",
      maskedPhoneNumber,
      previewCode: code
    };
  }
};

export { RecoveryDeliveryServiceError, getAppBaseUrl };

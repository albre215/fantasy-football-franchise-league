import { Resend } from "resend";

const TWILIO_VERIFY_API_BASE_URL = "https://verify.twilio.com/v2";

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

type RecoverySmsMode = "preview" | "twilio-verify";

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
  const mode = normalizeMode(process.env.AUTH_RECOVERY_SMS_MODE, "preview");

  if (mode !== "preview" && mode !== "twilio-verify") {
    throw new RecoveryDeliveryServiceError("AUTH_RECOVERY_SMS_MODE must be either 'preview' or 'twilio-verify'.");
  }

  return mode as RecoverySmsMode;
}

function assertPreviewModeIsSafe({
  mode,
  label,
  envVar,
  providerMode
}: {
  mode: string;
  label: string;
  envVar: string;
  providerMode: string;
}) {
  if (mode === "preview" && isProductionEnvironment()) {
    throw new RecoveryDeliveryServiceError(`Preview ${label} mode is disabled in production. Set ${envVar}=${providerMode}.`);
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

function getTwilioVerifyConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!accountSid) {
    throw new RecoveryDeliveryServiceError(
      "TWILIO_ACCOUNT_SID is required when AUTH_RECOVERY_SMS_MODE=twilio-verify."
    );
  }

  if (!authToken) {
    throw new RecoveryDeliveryServiceError(
      "TWILIO_AUTH_TOKEN is required when AUTH_RECOVERY_SMS_MODE=twilio-verify."
    );
  }

  if (!verifyServiceSid) {
    throw new RecoveryDeliveryServiceError(
      "TWILIO_VERIFY_SERVICE_SID is required when AUTH_RECOVERY_SMS_MODE=twilio-verify."
    );
  }

  return {
    accountSid,
    authToken,
    verifyServiceSid
  };
}

function normalizePhoneNumberForSms(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (phoneNumber.trim().startsWith("+") && digits.length >= 8) {
    return `+${digits}`;
  }

  throw new RecoveryDeliveryServiceError(
    "Phone verification requires a valid phone number on file in a supported format."
  );
}

function buildTwilioVerifyAuthHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function sendTwilioVerifyRequest({
  endpoint,
  body
}: {
  endpoint: string;
  body: URLSearchParams;
}) {
  const { accountSid, authToken, verifyServiceSid } = getTwilioVerifyConfig();

  let response: Response;

  try {
    response = await fetch(`${TWILIO_VERIFY_API_BASE_URL}/Services/${verifyServiceSid}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: buildTwilioVerifyAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
  } catch {
    throw new RecoveryDeliveryServiceError("Unable to reach Twilio Verify right now. Please try again.");
  }

  if (!response.ok) {
    throw new RecoveryDeliveryServiceError("Unable to process phone verification right now. Please try again.");
  }

  return (await response.json()) as {
    status?: string;
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
      assertPreviewModeIsSafe({
        mode,
        label: "password recovery email",
        envVar: "AUTH_RECOVERY_EMAIL_MODE",
        providerMode: "resend"
      });

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
    code?: string;
  }): Promise<TemporaryLoginDeliveryResult> {
    const mode = getRecoverySmsMode();
    const maskedPhoneNumber = maskPhoneNumber(phoneNumber);

    if (mode === "preview") {
      assertPreviewModeIsSafe({
        mode,
        label: "phone verification SMS",
        envVar: "AUTH_RECOVERY_SMS_MODE",
        providerMode: "twilio-verify"
      });

      if (!code) {
        throw new RecoveryDeliveryServiceError("A preview SMS code is required when AUTH_RECOVERY_SMS_MODE=preview.");
      }

      return {
        channel: "preview",
        maskedPhoneNumber,
        previewCode: code
      };
    }

    const normalizedPhoneNumber = normalizePhoneNumberForSms(phoneNumber);

    await sendTwilioVerifyRequest({
      endpoint: "Verifications",
      body: new URLSearchParams({
        To: normalizedPhoneNumber,
        Channel: "sms"
      })
    });

    return {
      channel: "sms",
      maskedPhoneNumber
    };
  },

  async checkTemporaryLoginCode({
    phoneNumber,
    code
  }: {
    phoneNumber: string;
    code: string;
  }) {
    const mode = getRecoverySmsMode();

    if (mode === "preview") {
      assertPreviewModeIsSafe({
        mode,
        label: "phone verification SMS",
        envVar: "AUTH_RECOVERY_SMS_MODE",
        providerMode: "twilio-verify"
      });

      throw new RecoveryDeliveryServiceError("Preview SMS verification should be checked locally.");
    }

    const normalizedPhoneNumber = normalizePhoneNumberForSms(phoneNumber);
    const result = await sendTwilioVerifyRequest({
      endpoint: "VerificationCheck",
      body: new URLSearchParams({
        To: normalizedPhoneNumber,
        Code: code.trim()
      })
    });

    return result.status === "approved";
  }
};

export { RecoveryDeliveryServiceError, getAppBaseUrl, getRecoverySmsMode };

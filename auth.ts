import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { AuthRecoveryServiceError, authRecoveryService } from "@/server/services/auth-recovery-service";

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_BYTES = 72;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidSignInInput(email: string, password: string) {
  if (!email || !password) {
    return false;
  }

  if (email.length > MAX_EMAIL_LENGTH || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return false;
  }

  return true;
}

function getSessionDisplayName(tokenDisplayName: unknown, fallbackName: string | null | undefined) {
  if (typeof tokenDisplayName === "string" && tokenDisplayName.trim()) {
    return tokenDisplayName;
  }

  if (fallbackName?.trim()) {
    return fallbackName;
  }

  return "";
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/"
  },
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: {
          label: "Email",
          type: "email"
        },
        password: {
          label: "Password",
          type: "password"
        }
      },
      async authorize(credentials) {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");

        if (!isValidSignInInput(email, password)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            passwordHash: true,
            profileImageUrl: true
          }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValidPassword = await compare(password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          displayName: user.displayName,
          profileImageUrl: user.profileImageUrl
        };
      }
    }),
    CredentialsProvider({
      id: "recovery-code",
      name: "Temporary Login Code",
      credentials: {
        challengeId: {
          label: "Challenge ID",
          type: "text"
        },
        code: {
          label: "Verification code",
          type: "text"
        }
      },
      async authorize(credentials) {
        const challengeId = String(credentials?.challengeId ?? "");
        const code = String(credentials?.code ?? "");

        try {
          return await authRecoveryService.verifyTemporaryLoginCode(challengeId, code);
        } catch (error) {
          if (error instanceof AuthRecoveryServiceError) {
            return null;
          }

          throw error;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        token.sub = user.id;
        token.displayName = user.name ?? "";
        token.authMethod = account?.provider === "recovery-code" ? "recovery-code" : "credentials";
        token.profileImageUrl = user.profileImageUrl ?? null;
      }

      if (trigger === "update" && session?.user) {
        if (session.user.displayName) {
          token.displayName = session.user.displayName;
        }

        if (session.user.email) {
          token.email = session.user.email;
        }

        token.profileImageUrl = session.user.profileImageUrl ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.displayName = getSessionDisplayName(token.displayName, session.user.name);
        session.user.authMethod = token.authMethod === "recovery-code" ? "recovery-code" : "credentials";
        session.user.profileImageUrl = token.profileImageUrl ?? null;
      }

      return session;
    }
  }
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}

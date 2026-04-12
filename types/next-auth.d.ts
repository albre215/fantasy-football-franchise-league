import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      displayName: string;
      authMethod: "credentials" | "recovery-code";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    displayName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    displayName?: string;
    authMethod?: "credentials" | "recovery-code";
  }
}

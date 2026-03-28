import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      displayName: string;
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
  }
}

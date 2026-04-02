import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/"
  }
});

export const config = {
  matcher: ["/league/:path*", "/dashboard/:path*", "/me/:path*", "/account/:path*"]
};

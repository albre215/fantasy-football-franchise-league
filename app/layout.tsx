import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";

import "@/app/globals.css";
import { BrandSideMarks } from "@/components/brand/brand-side-marks";
import { GlobalAccountDock } from "@/components/home/global-account-dock";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ScrollStabilityProvider } from "@/components/providers/scroll-stability-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-brand"
});

export const metadata: Metadata = {
  title: "GM Fantasy",
  description: "Production-ready platform foundation for multi-year NFL franchise fantasy leagues."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${oswald.variable} relative overflow-x-hidden`}>
        <BrandSideMarks />
        <AuthSessionProvider>
          <ScrollStabilityProvider>
            <GlobalAccountDock />
            <div className="relative z-10">{children}</div>
          </ScrollStabilityProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Newsreader, DM_Sans, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Newsreader — display font (titles, hero)
 * Light (300) + Regular (400), italic variants for display use.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  display: "swap",
});

/**
 * DM Sans — UI / body font (humanist grotesque)
 * Regular (400) + Medium (500) for labels and buttons.
 */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * Geist Mono — meta / timestamps / IDs
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JobNomad — Remote jobs for digital nomads",
  description:
    "Curated remote jobs matched to your skills and timezone. Apply only to positions that truly fit.",
  metadataBase: new URL("https://jobnomad.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${dmSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* Global toast provider — single instance, do NOT add another Toaster in sub-layouts */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

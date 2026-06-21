import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Saira_Condensed } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const saira = Saira_Condensed({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MGL Fantasy",
  description: "MGL fantasy football — live scores, standings, history & records.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${saira.variable}`}>
        <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-bg">
          <TopBar />
          <main className="flex-1 px-3 pb-24 pt-3">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}

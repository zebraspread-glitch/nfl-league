import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Saira_Condensed } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { SettingsProvider } from "@/components/settings-provider";

// Runs before paint to apply the saved theme, preventing a flash of light mode
// on load. Keep in sync with SettingsProvider's THEME_KEY.
const themeScript = `(function(){try{if(localStorage.getItem('mgl_theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const saira = Saira_Condensed({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const appName = "MGL Fantasy";
const appDescription = "MGL fantasy football - live scores, standings, history & records.";

export const metadata: Metadata = {
  applicationName: appName,
  title: appName,
  description: appDescription,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a7c6",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${saira.variable}`}>
        <SettingsProvider>
          <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-bg lg:max-w-none">
            <TopBar />
            <main
              className="flex-1 px-3 pb-24"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem + 0.75rem)" }}
            >
              {children}
            </main>
            <BottomNav />
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}

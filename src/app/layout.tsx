import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TeenMind Research — Kenali Dirimu, Jaga Kesehatan Mental",
  description:
    "Platform penelitian tesis tentang faktor biopsikososial depresi remaja SMP. Dibuat dengan pengalaman modern dan ramah remaja.",
  keywords: [
    "TeenMind",
    "penelitian remaja",
    "depresi remaja",
    "kesehatan mental",
    "CESD-R",
    "PSQI",
    "MOS-SSS",
    "SMP",
  ],
  authors: [{ name: "TeenMind Research Team" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TeenMind",
  },
  openGraph: {
    title: "TeenMind Research",
    description: "Kenali Dirimu, Bantu Penelitian, Jaga Kesehatan Mental",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7dd3c0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}

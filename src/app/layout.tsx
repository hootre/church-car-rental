import type { Metadata, Viewport } from "next";
import ToasterProvider from "@/components/ToasterProvider";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

const churchName = "한국중앙교회";
const siteTitle = `${churchName} 차량부`;
const siteDescription = "한국중앙교회 차량부 차량 대여 예약 시스템";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://church-car-rental.vercel.app";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152" },
      { url: "/icons/icon-192x192.png", sizes: "192x192" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "차량부",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: churchName,
    images: [
      {
        url: "/og-image.png",
        width: 800,
        height: 600,
        alt: siteTitle,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <ToasterProvider />
        <PWARegister />
        {children}
      </body>
    </html>
  );
}

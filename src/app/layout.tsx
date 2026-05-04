import type { Metadata, Viewport } from "next";
import ToasterProvider from "@/components/ToasterProvider";
import "./globals.css";

const churchName = "한국중앙교회";
const siteTitle = `${churchName} 차량대여`;
const siteDescription = "한국중앙교회 주차부 차량 대여 예약 시스템";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://church-car-rental.vercel.app";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  icons: {
    icon: "/favicon.ico",
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
        {children}
      </body>
    </html>
  );
}

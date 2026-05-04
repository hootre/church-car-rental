import type { Metadata, Viewport } from "next";
import ToasterProvider from "@/components/ToasterProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_CHURCH_NAME || "교회"} 차량 대여`,
  description: "교회 주차부 차량 대여 예약 시스템",
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

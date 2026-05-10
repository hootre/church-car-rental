"use client";

import { Toaster } from "react-hot-toast";

/**
 * 사이트 디자인과 통일된 Toast 스타일
 * - 둥근 모서리, 부드러운 그림자
 * - 성공: 초록 / 에러: 빨강 / 기본: 흰 배경
 * - 모바일 상단에 띄움
 */
export default function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      gutter={8}
      containerStyle={{ top: 70 }}
      toastOptions={{
        duration: 2800,
        style: {
          background: "#ffffff",
          color: "#1f2937",
          borderRadius: "14px",
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: 500,
          maxWidth: "92vw",
          boxShadow:
            "0 10px 30px -10px rgba(0,0,0,0.18), 0 4px 12px -4px rgba(0,0,0,0.06)",
          border: "1px solid rgba(229, 231, 235, 0.8)",
        },
        success: {
          duration: 2400,
          iconTheme: { primary: "#10b981", secondary: "#ffffff" },
          style: {
            borderColor: "rgba(16, 185, 129, 0.25)",
          },
        },
        error: {
          duration: 3500,
          iconTheme: { primary: "#ef4444", secondary: "#ffffff" },
          style: {
            borderColor: "rgba(239, 68, 68, 0.25)",
          },
        },
        loading: {
          iconTheme: { primary: "#2563eb", secondary: "#ffffff" },
        },
      }}
    />
  );
}

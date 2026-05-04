"use client";

import { Toaster } from "react-hot-toast";

export default function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: { borderRadius: "12px", padding: "12px 16px" },
      }}
    />
  );
}

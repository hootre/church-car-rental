"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface Props {
  adminId: string;
}

export default function PushNotificationToggle({ adminId }: Props) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // 브라우저 지원 여부 & 현재 구독 상태 확인
  const checkStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  async function handleToggle() {
    if (loading) return;
    setLoading(true);

    try {
      if (subscribed) {
        // 구독 해제
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await fetch("/api/admin/push-subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
          }
        }
        setSubscribed(false);
        toast.success("알림이 해제되었습니다");
      } else {
        // 구독 등록
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("알림 권한이 거부되었습니다.\n브라우저 설정에서 허용해 주세요.");
          setLoading(false);
          return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          toast.error("푸시 설정이 완료되지 않았습니다");
          setLoading(false);
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const res = await fetch("/api/admin/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });

        if (!res.ok) throw new Error("구독 등록 실패");

        setSubscribed(true);
        toast.success("알림이 활성화되었습니다");
      }
    } catch (err) {
      console.error("[PUSH] 토글 오류:", err);
      toast.error("알림 설정 중 오류가 발생했습니다");
    }

    setLoading(false);
  }

  if (!supported) return null;

  // adminId is used for context; subscription is per-device per-admin
  void adminId;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
        subscribed
          ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      }`}
      title={subscribed ? "알림 ON — 클릭하여 해제" : "알림 OFF — 클릭하여 활성화"}
    >
      {loading ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill={subscribed ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )}
      <span>{subscribed ? "알림 ON" : "알림"}</span>
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

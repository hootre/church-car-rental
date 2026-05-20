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
  const [testing, setTesting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  function addDebug(msg: string) {
    setDebugInfo((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  const checkStatus = useCallback(async () => {
    const info: string[] = [];

    if (!("serviceWorker" in navigator)) {
      info.push("❌ Service Worker 미지원");
      setSupported(false);
      setDebugInfo(info);
      return;
    }
    info.push("✅ Service Worker 지원");

    if (!("PushManager" in window)) {
      info.push("❌ PushManager 미지원");
      setSupported(false);
      setDebugInfo(info);
      return;
    }
    info.push("✅ PushManager 지원");

    const permission = Notification.permission;
    info.push(`📋 알림 권한: ${permission}`);

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      || "BPtooG1pLf-sV0ZSFq_b_97c5q3V4FQ2tbjLRzHBm0LbIrqWVEYdOkn-pHvLiPMgXTn9kwPl2q433qrBkjJKH7g";
    info.push(vapidKey ? `✅ VAPID 키 설정됨 (${vapidKey.slice(0, 20)}...)` : "❌ VAPID 키 미설정");

    setSupported(true);

    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        info.push(`✅ SW 등록됨 (scope: ${reg.scope})`);
        info.push(`   SW 상태: ${reg.active ? "active" : reg.waiting ? "waiting" : reg.installing ? "installing" : "없음"}`);
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          info.push(`✅ 푸시 구독 활성 (endpoint: ${sub.endpoint.slice(0, 60)}...)`);
          setSubscribed(true);
        } else {
          info.push("⚠️ 푸시 구독 없음");
          setSubscribed(false);
        }
      } else {
        info.push("⚠️ SW 미등록 (/sw.js)");
        setSubscribed(false);
      }
    } catch (err) {
      info.push(`❌ 상태 확인 오류: ${err}`);
    }

    // 서버 구독 상태 확인
    try {
      const res = await fetch("/api/admin/push-subscribe");
      if (res.ok) {
        const data = await res.json();
        info.push(`📡 서버 구독: ${data.subscribed ? `${data.count}건 등록됨` : "없음"}`);
      } else {
        info.push(`⚠️ 서버 구독 확인 실패 (${res.status})`);
      }
    } catch (err) {
      info.push(`❌ 서버 확인 오류: ${err}`);
    }

    setDebugInfo(info);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  async function handleToggle() {
    if (loading) return;
    setLoading(true);

    try {
      if (subscribed) {
        addDebug("구독 해제 시작...");
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const res = await fetch("/api/admin/push-subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            addDebug(`서버 해제 응답: ${res.status}`);
            await sub.unsubscribe();
            addDebug("브라우저 구독 해제 완료");
          }
        }
        setSubscribed(false);
        toast.success("알림이 해제되었습니다");
      } else {
        addDebug("구독 등록 시작...");

        const permission = await Notification.requestPermission();
        addDebug(`알림 권한 결과: ${permission}`);
        if (permission !== "granted") {
          toast.error("알림 권한이 거부되었습니다.\n브라우저 설정에서 허용해 주세요.");
          setLoading(false);
          return;
        }

        addDebug("Service Worker 등록 중...");
        const reg = await navigator.serviceWorker.register("/sw.js");
        addDebug(`SW 등록 완료 (scope: ${reg.scope})`);

        await navigator.serviceWorker.ready;
        addDebug("SW ready");

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          || "BPtooG1pLf-sV0ZSFq_b_97c5q3V4FQ2tbjLRzHBm0LbIrqWVEYdOkn-pHvLiPMgXTn9kwPl2q433qrBkjJKH7g";
        if (!vapidPublicKey) {
          addDebug("❌ VAPID 공개키 없음!");
          toast.error("푸시 설정이 완료되지 않았습니다");
          setLoading(false);
          return;
        }

        addDebug("pushManager.subscribe 호출...");
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        addDebug(`구독 성공! endpoint: ${sub.endpoint.slice(0, 60)}...`);

        const subJson = sub.toJSON();
        addDebug(`keys.p256dh: ${subJson.keys?.p256dh ? "있음" : "없음"}`);
        addDebug(`keys.auth: ${subJson.keys?.auth ? "있음" : "없음"}`);

        addDebug("서버에 구독 등록 중...");
        const res = await fetch("/api/admin/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subJson }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          addDebug(`❌ 서버 등록 실패: ${res.status} — ${JSON.stringify(errData)}`);
          throw new Error("구독 등록 실패");
        }

        addDebug("✅ 서버 등록 완료!");
        setSubscribed(true);
        toast.success("알림이 활성화되었습니다");
      }
    } catch (err) {
      console.error("[PUSH] 토글 오류:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      addDebug(`❌ 오류: ${errMsg}`);
      toast.error(`알림 설정 오류: ${errMsg}`);
    }

    setLoading(false);
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    addDebug("테스트 알림 발송 요청...");

    try {
      const res = await fetch("/api/admin/push-test", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        addDebug(`✅ 테스트 결과: ${data.message}`);
        toast.success(data.message);
      } else {
        addDebug(`❌ 테스트 실패: ${JSON.stringify(data)}`);
        toast.error(data.error || "테스트 실패");
      }
    } catch (err) {
      addDebug(`❌ 테스트 오류: ${err}`);
      toast.error("테스트 발송 중 오류");
    }

    setTesting(false);
  }

  if (!supported) return null;

  void adminId;

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
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

        {subscribed && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs px-2 py-1.5 rounded-lg text-orange-500 hover:bg-orange-50 transition-colors"
            title="테스트 알림 보내기"
          >
            {testing ? "발송중..." : "테스트"}
          </button>
        )}

        <button
          onClick={() => { setShowDebug(!showDebug); if (!showDebug) checkStatus(); }}
          className="text-xs px-1.5 py-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
          title="디버그 정보"
        >
          🔧
        </button>
      </div>

      {showDebug && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700">푸시 알림 디버그</span>
            <button onClick={() => setShowDebug(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {debugInfo.map((line, i) => (
              <p key={i} className="text-[10px] text-gray-600 font-mono leading-relaxed">{line}</p>
            ))}
          </div>
          <button
            onClick={() => checkStatus()}
            className="mt-2 w-full text-xs text-center py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
          >
            새로고침
          </button>
        </div>
      )}
    </div>
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

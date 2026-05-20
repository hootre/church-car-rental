/**
 * 클라이언트 푸시 알림 자동 등록
 * 관리자 로그인 시 호출 — 권한 요청 → SW 등록 → 구독 → 서버 저장
 */

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BPtooG1pLf-sV0ZSFq_b_97c5q3V4FQ2tbjLRzHBm0LbIrqWVEYdOkn-pHvLiPMgXTn9kwPl2q433qrBkjJKH7g";

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

/**
 * 관리자 로그인/세션 복원 시 자동 호출.
 * - 이미 구독되어 있으면 아무것도 안 함
 * - 권한이 default면 요청, denied면 스킵
 * - 구독 성공하면 서버에 저장
 */
export async function autoRegisterPush(): Promise<void> {
  try {
    // 브라우저 지원 확인
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return;
    }

    // iOS Safari는 홈 화면에 추가된 상태(standalone)에서만 푸시 지원
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
        || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!isStandalone) {
        console.log("[PUSH] iOS: 홈 화면에 추가된 상태에서만 푸시 알림 가능");
        return;
      }
    }

    // 이미 거부된 경우 다시 묻지 않음
    if (Notification.permission === "denied") {
      return;
    }

    // 권한 요청 (default → granted/denied)
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return;
    }

    // Service Worker 등록
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // 이미 구독되어 있는지 확인
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      // 이미 구독됨 — 서버에도 있는지 확인하고 없으면 다시 저장
      await saveSubscription(existingSub);
      return;
    }

    // 새 구독 생성
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await saveSubscription(sub);
    console.log("[PUSH] 자동 구독 등록 완료");
  } catch (err) {
    // 자동 등록은 조용히 실패 (사용자 경험에 영향 없음)
    console.warn("[PUSH] 자동 등록 실패:", err);
  }
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const res = await fetch("/api/admin/push-subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });

  if (!res.ok) {
    console.warn("[PUSH] 서버 구독 저장 실패:", res.status);
  }
}

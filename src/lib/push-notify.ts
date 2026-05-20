import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// VAPID 설정 (환경변수 우선, 없으면 하드코딩 fallback)
const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BPtooG1pLf-sV0ZSFq_b_97c5q3V4FQ2tbjLRzHBm0LbIrqWVEYdOkn-pHvLiPMgXTn9kwPl2q433qrBkjJKH7g";
const VAPID_PRIVATE =
  process.env.VAPID_PRIVATE_KEY ||
  "n6ovr6btxYrN_61nFAKSQwpQ1q5gze7kZJPRNuxpqmE";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:artinsky@boramedia.co.kr";

let vapidReady = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } catch (err) {
    console.error("[PUSH] VAPID 설정 오류:", err);
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** 디버그 정보 반환 */
export function getPushDebugInfo() {
  return {
    vapidReady,
    vapidPublicSet: !!VAPID_PUBLIC,
    vapidPrivateSet: !!VAPID_PRIVATE,
    vapidPublicPrefix: VAPID_PUBLIC?.slice(0, 15) || "",
  };
}

/**
 * 모든 구독된 관리자에게 푸시 알림 전송
 */
export async function sendPushToAllAdmins(payload: PushPayload): Promise<number> {
  if (!vapidReady) {
    console.log("[PUSH] VAPID 미준비 — 푸시 발송 스킵");
    return 0;
  }

  const { data: subscriptions, error: dbError } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (dbError) {
    console.error("[PUSH] DB 조회 오류:", dbError.message);
    return 0;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("[PUSH] 구독자 0명 — 발송 스킵");
    return 0;
  }

  let sentCount = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };

      try {
        await webPush.sendNotification(
          pushSubscription,
          JSON.stringify(payload)
        );
        sentCount++;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error(`[PUSH] 발송 실패 (${statusCode}):`, sub.endpoint.slice(0, 60));
        }
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
    console.log(`[PUSH] 만료된 구독 ${expiredEndpoints.length}개 제거`);
  }

  console.log(`[PUSH] ${sentCount}/${subscriptions.length}명 발송 완료`);
  return sentCount;
}

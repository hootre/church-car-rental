import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// VAPID 설정
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:artinsky@boramedia.co.kr";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * 모든 구독된 관리자에게 푸시 알림 전송
 */
export async function sendPushToAllAdmins(payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log("[PUSH] VAPID 키 미설정 — 푸시 발송 스킵");
    return 0;
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (!subscriptions || subscriptions.length === 0) return 0;

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
        // 410 Gone 또는 404 = 구독 만료 → DB에서 제거
        if (statusCode === 410 || statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error(`[PUSH] 발송 실패 (${statusCode}):`, sub.endpoint.slice(0, 60));
        }
      }
    })
  );

  // 만료된 구독 정리
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

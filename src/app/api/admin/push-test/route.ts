import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest, unauthorizedResponse } from "@/lib/auth";
import { sendPushToAllAdmins } from "@/lib/push-notify";

// 푸시 알림 테스트 발송
export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  // 디버그: 환경변수 확인
  const debug = {
    hasVapidPublic: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
    vapidPublicPrefix: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.slice(0, 10) || "미설정",
    vapidPrivatePrefix: process.env.VAPID_PRIVATE_KEY?.slice(0, 6) || "미설정",
  };

  try {
    const sentCount = await sendPushToAllAdmins({
      title: "🔔 테스트 알림",
      body: `${admin.name}님이 테스트 알림을 보냈습니다.`,
      url: "/admin",
      tag: "push-test",
    });

    return NextResponse.json({
      success: true,
      sentCount,
      debug,
      message: sentCount > 0
        ? `${sentCount}명에게 발송 완료`
        : "발송 대상이 없습니다 (구독된 관리자 없음 또는 VAPID 키 미설정)",
    });
  } catch (err) {
    console.error("[PUSH-TEST] 오류:", err);
    return NextResponse.json(
      { error: "푸시 테스트 실패", detail: String(err), debug },
      { status: 500 }
    );
  }
}

// 디버그용: 환경변수 + DB 구독 상태 확인
export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, admin_id, endpoint, created_at");

  return NextResponse.json({
    env: {
      hasVapidPublic: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
    subscriptions: subs || [],
    dbError: error?.message || null,
    adminId: admin.id,
  });
}

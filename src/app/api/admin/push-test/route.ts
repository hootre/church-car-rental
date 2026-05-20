import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminFromRequest, unauthorizedResponse } from "@/lib/auth";
import { sendPushToAllAdmins, getPushDebugInfo } from "@/lib/push-notify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 푸시 알림 테스트 발송
export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  const debug = getPushDebugInfo();

  // DB에서 구독자 수 확인
  const { data: subs, error: dbError } = await supabase
    .from("push_subscriptions")
    .select("id, admin_id, endpoint");

  const subCount = subs?.length || 0;

  try {
    const sentCount = await sendPushToAllAdmins({
      title: "🔔 테스트 알림",
      body: `${admin.name}님이 테스트 알림을 보냈습니다.`,
      url: "/admin",
      tag: "push-test",
    });

    let message = "";
    if (sentCount > 0) {
      message = `${sentCount}명에게 발송 완료`;
    } else if (!debug.vapidReady) {
      message = "VAPID 키가 설정되지 않았습니다";
    } else if (dbError) {
      message = `DB 오류: ${dbError.message}`;
    } else if (subCount === 0) {
      message = "DB에 등록된 구독이 없습니다 (구독 저장이 실패했을 수 있음)";
    } else {
      message = `구독 ${subCount}건 있으나 발송 실패`;
    }

    return NextResponse.json({
      success: sentCount > 0,
      sentCount,
      subCount,
      debug,
      dbError: dbError?.message || null,
      message,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "푸시 테스트 실패", detail: String(err), debug, subCount },
      { status: 500 }
    );
  }
}

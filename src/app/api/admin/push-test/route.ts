import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest, unauthorizedResponse } from "@/lib/auth";
import { sendPushToAllAdmins } from "@/lib/push-notify";

// 푸시 알림 테스트 발송
export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

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
      message: sentCount > 0
        ? `${sentCount}명에게 발송 완료`
        : "발송 대상이 없습니다 (구독된 관리자 없음 또는 VAPID 키 미설정)",
    });
  } catch (err) {
    console.error("[PUSH-TEST] 오류:", err);
    return NextResponse.json(
      { error: "푸시 테스트 실패", detail: String(err) },
      { status: 500 }
    );
  }
}

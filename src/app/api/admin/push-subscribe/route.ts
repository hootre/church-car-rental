import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminFromRequest, unauthorizedResponse } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 푸시 구독 등록
export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  try {
    const { subscription } = await request.json();

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "유효하지 않은 구독 정보입니다" }, { status: 400 });
    }

    // upsert (같은 endpoint면 업데이트)
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          admin_id: admin.id,
          endpoint: subscription.endpoint,
          keys_p256dh: subscription.keys.p256dh,
          keys_auth: subscription.keys.auth,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("Push subscribe error:", error);
      return NextResponse.json(
        { error: "구독 등록에 실패했습니다", detail: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push subscribe exception:", err);
    return NextResponse.json(
      { error: "서버 오류", detail: String(err) },
      { status: 500 }
    );
  }
}

// 푸시 구독 해제
export async function DELETE(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint가 필요합니다" }, { status: 400 });
    }

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("admin_id", admin.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// 현재 구독 상태 확인
export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .eq("admin_id", admin.id);

  return NextResponse.json({
    subscribed: (data || []).length > 0,
    count: (data || []).length,
  });
}

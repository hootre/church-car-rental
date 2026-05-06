import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// SMS 설정 + 오늘 발송량 조회
export async function GET() {
  const { data: settings } = await supabase
    .from("sms_settings")
    .select("*")
    .eq("id", "default")
    .single();

  // 오늘 발송 건수
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .gte("sent_at", today.toISOString());

  return NextResponse.json({
    mode: settings?.mode || "free",
    daily_limit: settings?.daily_limit || 50,
    today_sent: count || 0,
    message_template: settings?.message_template || "[차량부] 예약 승인 완료\\n차량: {vehicle}\\n기간: {start}~{end}\\n안전 운행하세요!",
  });
}

// SMS 설정 변경 (최고관리자만)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { admin_id, mode, message_template } = body;

    // 최고관리자 확인
    if (admin_id) {
      const { data: admin } = await supabase
        .from("admins")
        .select("role")
        .eq("id", admin_id)
        .single();

      if (!admin || admin.role !== "super_admin") {
        return NextResponse.json({ error: "최고관리자만 변경할 수 있습니다" }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: admin_id || null,
    };

    if (mode && ["free", "paid"].includes(mode)) {
      updateData.mode = mode;
    }

    if (typeof message_template === "string") {
      updateData.message_template = message_template;
    }

    const { error } = await supabase
      .from("sms_settings")
      .update(updateData)
      .eq("id", "default");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

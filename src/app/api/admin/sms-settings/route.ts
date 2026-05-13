import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { writeAdminLog } from "@/lib/admin-log";
import { getAdminFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// SMS 설정 + 오늘 발송량 조회 (관리자 인증 필수)
export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  const { data: settings } = await supabase
    .from("sms_settings")
    .select("*")
    .eq("id", "default")
    .single();

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

// SMS 설정 변경 (최고관리자만 - JWT 인증)
export async function PATCH(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse("최고관리자만 변경할 수 있습니다");

  try {
    const body = await request.json();
    const { mode, message_template } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
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

    const logDetails: Record<string, unknown> = {};
    if (mode) logDetails.mode = mode;
    if (typeof message_template === "string") logDetails.template_changed = true;

    writeAdminLog({
      admin_id: admin.id,
      admin_name: admin.name,
      action: "sms_settings_change",
      target_type: "settings",
      details: logDetails,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

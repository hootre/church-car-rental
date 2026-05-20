import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 전체 관리자의 푸시 구독 현황 조회 (최고관리자만)
export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse();

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("admin_id, endpoint, created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // admin_id별 구독 수 집계
  const statusMap: Record<string, number> = {};
  for (const sub of data || []) {
    statusMap[sub.admin_id] = (statusMap[sub.admin_id] || 0) + 1;
  }

  return NextResponse.json({ statusMap });
}

// 특정 관리자의 푸시 구독 전체 삭제 (최고관리자만)
export async function DELETE(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse();

  try {
    const { admin_id } = await request.json();
    if (!admin_id) {
      return NextResponse.json({ error: "admin_id 필요" }, { status: 400 });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("admin_id", admin_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

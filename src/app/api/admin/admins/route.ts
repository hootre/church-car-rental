import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { writeAdminLog } from "@/lib/admin-log";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 관리자 목록 조회
export async function GET() {
  const { data, error } = await supabase
    .from("admins")
    .select("id, login_id, name, phone, role, is_active, created_at, last_login_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 관리자 추가
export async function POST(request: NextRequest) {
  try {
    const { login_id, password, name, phone, role, requester_id, requester_name } = await request.json();

    if (!login_id || !password || !name) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해 주세요" },
        { status: 400 }
      );
    }

    // 중복 ID 체크
    const { data: existing } = await supabase
      .from("admins")
      .select("id")
      .eq("login_id", login_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다" },
        { status: 409 }
      );
    }

    // 비밀번호 해싱
    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("admins")
      .insert({
        login_id,
        password_hash,
        name,
        phone: phone || null,
        role: role || "admin",
      })
      .select("id, login_id, name, phone, role, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 로그 기록
    if (requester_id) {
      writeAdminLog({
        admin_id: requester_id,
        admin_name: requester_name || "관리자",
        action: "admin_add",
        target_type: "admin",
        target_id: data.id,
        details: { added_name: name, added_login_id: login_id, added_role: role },
      });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Create admin error:", err);
    return NextResponse.json(
      { error: "서버 오류�� 발생했습니다" },
      { status: 500 }
    );
  }
}

// 관리자 수정 (비밀��호 변경, 활성화 토글)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, is_active, phone, requester_id, requester_name } = body;

    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const logDetails: Record<string, unknown> = {};

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
      logDetails.changed = "password";
    }

    if (typeof is_active === "boolean") {
      updates.is_active = is_active;
      logDetails.is_active = is_active;
    }

    if (typeof phone === "string") {
      updates.phone = phone || null;
      logDetails.phone = phone;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "변경할 항목이 없습니다" }, { status: 400 });
    }

    const { error } = await supabase
      .from("admins")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 로그 기록
    if (requester_id) {
      writeAdminLog({
        admin_id: requester_id,
        admin_name: requester_name || "관리자",
        action: "admin_edit",
        target_type: "admin",
        target_id: id,
        details: logDetails,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update admin error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 관리자 삭제 (최고관리자만)
export async function DELETE(request: NextRequest) {
  try {
    const { id, requester_id, requester_name, requester_role } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }

    // 최고관리자 권한 체크
    if (requester_role !== "super_admin") {
      return NextResponse.json({ error: "최고관리자만 삭제할 수 있습니다" }, { status: 403 });
    }

    // 삭제 대상 정보 먼저 조회 (로그용)
    const { data: targetAdmin } = await supabase
      .from("admins")
      .select("name, login_id, role")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("admins").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 로그 기록
    if (requester_id) {
      writeAdminLog({
        admin_id: requester_id,
        admin_name: requester_name || "관리자",
        action: "admin_delete",
        target_type: "admin",
        target_id: id,
        details: {
          deleted_name: targetAdmin?.name,
          deleted_login_id: targetAdmin?.login_id,
          deleted_role: targetAdmin?.role,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete admin error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

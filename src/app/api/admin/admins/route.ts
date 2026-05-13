import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { writeAdminLog } from "@/lib/admin-log";
import { getAdminFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 관리자 목록 조회
export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  const { data, error } = await supabase
    .from("admins")
    .select("id, login_id, name, phone, role, is_active, created_at, last_login_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 관리자 추가 (최고관리자만)
export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse("최고관리자만 관리자를 추가할 수 있습니다");

  try {
    const { login_id, password, name, phone, role } = await request.json();

    if (!login_id || !password || !name) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해 주세요" },
        { status: 400 }
      );
    }

    // 입력값 길이 검증
    if (login_id.length > 50 || name.length > 50 || password.length > 100) {
      return NextResponse.json({ error: "입력값이 너무 깁니다" }, { status: 400 });
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

    // 비밀번호 해싱 (salt rounds 12)
    const password_hash = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from("admins")
      .insert({
        login_id: login_id.trim(),
        password_hash,
        name: name.trim(),
        phone: phone?.trim() || null,
        role: role || "member",
      })
      .select("id, login_id, name, phone, role, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    writeAdminLog({
      admin_id: admin.id,
      admin_name: admin.name,
      action: "admin_add",
      target_type: "admin",
      target_id: data.id,
      details: { added_name: name, added_login_id: login_id, added_role: role },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Create admin error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 관리자 수정
export async function PATCH(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { id, password, is_active, phone } = body;

    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }

    // 자기 자신이 아닌 경우 최고관리자만 수정 가능
    if (id !== admin.id && admin.role !== "super_admin") {
      return forbiddenResponse("다른 관리자의 정보는 최고관리자만 수정할 수 있습니다");
    }

    const updates: Record<string, unknown> = {};
    const logDetails: Record<string, unknown> = {};

    if (password) {
      if (password.length < 4 || password.length > 100) {
        return NextResponse.json({ error: "비밀번호는 4~100자로 입력해 주세요" }, { status: 400 });
      }
      updates.password_hash = await bcrypt.hash(password, 12);
      logDetails.changed = "password";
    }

    if (typeof is_active === "boolean") {
      // 활성화/비활성화는 최고관리자만
      if (admin.role !== "super_admin") {
        return forbiddenResponse("관리자 활성화/비활성화는 최고관리자만 가능합니다");
      }
      updates.is_active = is_active;
      logDetails.is_active = is_active;
    }

    if (typeof phone === "string") {
      updates.phone = phone.trim() || null;
      logDetails.phone = phone;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "변경할 항목이 없습니다" }, { status: 400 });
    }

    const { error } = await supabase.from("admins").update(updates).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    writeAdminLog({
      admin_id: admin.id,
      admin_name: admin.name,
      action: "admin_edit",
      target_type: "admin",
      target_id: id,
      details: logDetails,
    });

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
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse("최고관리자만 삭제할 수 있습니다");

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }

    // 자기 자신 삭제 방지
    if (id === admin.id) {
      return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다" }, { status: 400 });
    }

    // 삭제 대상 정보 조회 (로그용)
    const { data: targetAdmin } = await supabase
      .from("admins")
      .select("name, login_id, role")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("admins").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    writeAdminLog({
      admin_id: admin.id,
      admin_name: admin.name,
      action: "admin_delete",
      target_type: "admin",
      target_id: id,
      details: {
        deleted_name: targetAdmin?.name,
        deleted_login_id: targetAdmin?.login_id,
        deleted_role: targetAdmin?.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete admin error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

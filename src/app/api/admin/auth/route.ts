import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { login_id, password } = await request.json();

    if (!login_id || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해 주세요" },
        { status: 400 }
      );
    }

    // 관리자 조회
    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("login_id", login_id)
      .eq("is_active", true)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다" },
        { status: 401 }
      );
    }

    // 비밀번호 검증
    let isValid = false;

    // bcrypt 해시인지 확인 ($2a$ 또는 $2b$로 시작)
    if (admin.password_hash.startsWith("$2")) {
      isValid = await bcrypt.compare(password, admin.password_hash);
    } else {
      // 초기 평문 비밀번호 (첫 로그인 시 해싱으로 업그레이드)
      isValid = password === admin.password_hash;
      if (isValid) {
        // 평문을 해시로 업그레이드
        const hash = await bcrypt.hash(password, 10);
        await supabase
          .from("admins")
          .update({ password_hash: hash })
          .eq("id", admin.id);
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다" },
        { status: 401 }
      );
    }

    // 마지막 로그인 시간 업데이트
    await supabase
      .from("admins")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", admin.id);

    return NextResponse.json({
      admin: {
        id: admin.id,
        login_id: admin.login_id,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("Auth error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

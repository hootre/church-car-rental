import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import {
  signToken,
  setTokenCookie,
  clearTokenCookie,
  checkRateLimit,
  resetRateLimit,
} from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 로그인
export async function POST(request: NextRequest) {
  try {
    // IP 기반 레이트 리밋
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      const retryMin = Math.ceil(rateCheck.retryAfterMs / 60000);
      return NextResponse.json(
        { error: `로그인 시도가 너무 많습니다. ${retryMin}분 후에 다시 시도해 주세요` },
        { status: 429 }
      );
    }

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

    if (admin.password_hash.startsWith("$2")) {
      isValid = await bcrypt.compare(password, admin.password_hash);
    } else {
      // 초기 평문 비밀번호 → 해싱 업그레이드
      isValid = password === admin.password_hash;
      if (isValid) {
        const hash = await bcrypt.hash(password, 12);
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

    // 로그인 성공 → 레이트 리밋 초기화
    resetRateLimit(ip);

    // JWT 토큰 생성
    const token = signToken({
      id: admin.id,
      login_id: admin.login_id,
      name: admin.name,
      role: admin.role,
    });

    // 마지막 로그인 시간 업데이트
    await supabase
      .from("admins")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", admin.id);

    // 응답에 httpOnly 쿠키 설정
    const response = NextResponse.json({
      admin: {
        id: admin.id,
        login_id: admin.login_id,
        name: admin.name,
        role: admin.role,
      },
    });

    setTokenCookie(response, token);
    return response;
  } catch (err) {
    console.error("Auth error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 로그아웃 (쿠키 삭제)
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearTokenCookie(response);
  return response;
}

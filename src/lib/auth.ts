import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SECRET = process.env.JWT_SECRET || "church-car-rental-change-this-in-production";
const COOKIE_NAME = "admin_token";
const TOKEN_EXPIRY_HOURS = 168; // 7일

export interface AdminPayload {
  id: string;
  login_id: string;
  name: string;
  role: string;
}

// JWT 서명 (외부 라이브러리 없이 Node.js crypto 사용)
export function signToken(payload: AdminPayload): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const data = { ...payload, iat: now, exp: now + TOKEN_EXPIRY_HOURS * 3600 };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(data)).toString("base64url");

  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

// JWT 검증
export function verifyToken(token: string): AdminPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    // 타이밍 공격 방지를 위한 상수 시간 비교
    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

    // 만료 확인
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.id,
      login_id: payload.login_id,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// 요청에서 관리자 정보 추출 (쿠키 → Authorization 헤더 순)
export function getAdminFromRequest(request: NextRequest): AdminPayload | null {
  // 1. httpOnly 쿠키에서 토큰 확인
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  // 2. Authorization 헤더에서 확인
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7));
  }

  return null;
}

// 인증 실패 응답
export function unauthorizedResponse(message = "인증이 필요합니다") {
  return NextResponse.json({ error: message }, { status: 401 });
}

// 권한 부족 응답
export function forbiddenResponse(message = "권한이 없습니다") {
  return NextResponse.json({ error: message }, { status: 403 });
}

// JWT 쿠키 설정
export function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_EXPIRY_HOURS * 3600,
    path: "/",
  });
}

// JWT 쿠키 삭제
export function clearTokenCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

// ===== 로그인 시도 제한 (Rate Limiting) =====
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15분

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  // 오래된 기록 정리 (메모리 누수 방지)
  if (loginAttempts.size > 10000) {
    for (const [key, val] of loginAttempts) {
      if (val.resetAt < now) loginAttempts.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterMs: 0 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfterMs: record.resetAt - now };
  }

  record.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count, retryAfterMs: 0 };
}

export function resetRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

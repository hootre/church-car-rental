import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getAdminFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 테스트 발송 (최고관리자만 - JWT 인증)
export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse("최고관리자만 테스트 발송할 수 있습니다");

  try {
    const { phone } = await request.json();

    const diagnostics: string[] = [];

    // 1. 환경변수 체크
    const apiKey = process.env.COOLSMS_API_KEY;
    const apiSecret = process.env.COOLSMS_API_SECRET;
    const sender = process.env.COOLSMS_SENDER;

    diagnostics.push(`[1] COOLSMS_API_KEY: ${apiKey ? `설정됨 (${apiKey.slice(0, 4)}****)` : "❌ 미설정"}`);
    diagnostics.push(`[2] COOLSMS_API_SECRET: ${apiSecret ? `설정됨 (${apiSecret.slice(0, 4)}****)` : "❌ 미설정"}`);
    diagnostics.push(`[3] COOLSMS_SENDER: ${sender || "❌ 미설정"}`);

    if (!apiKey || !apiSecret || !sender) {
      return NextResponse.json({
        success: false,
        error: "환경변수 미설정 - Vercel에서 COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER 설정 필요",
        diagnostics,
      });
    }

    // 2. 수신번호 확인
    const cleanPhone = (phone || "").replace(/-/g, "");
    const cleanSender = sender.replace(/-/g, "");
    diagnostics.push(`[4] 수신번호: ${cleanPhone || "❌ 미입력"}`);
    diagnostics.push(`[5] 발신번호: ${cleanSender}`);

    if (!cleanPhone) {
      return NextResponse.json({
        success: false,
        error: "수신 번호를 입력해 주세요",
        diagnostics,
      });
    }

    // 3. 인증 헤더 생성
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(date + salt)
      .digest("hex");
    const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
    diagnostics.push(`[6] 인증 헤더 생성 완료`);

    // 4. API 호출
    const testMessage = "[차량부] SMS 테스트 발송입니다.";
    const body = {
      messages: [
        {
          to: cleanPhone,
          from: cleanSender,
          text: testMessage,
          type: "SMS" as const,
        },
      ],
    };

    diagnostics.push(`[7] API 호출 시작: https://api.coolsms.co.kr/messages/v4/send-many/detail`);
    diagnostics.push(`[8] 요청 본문: ${JSON.stringify(body)}`);

    const response = await fetch("https://api.coolsms.co.kr/messages/v4/send-many/detail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    diagnostics.push(`[9] 응답 상태: ${response.status} ${response.statusText}`);
    diagnostics.push(`[10] 응답 내용: ${responseText}`);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `CoolSMS API 에러 (${response.status}): ${responseText}`,
        diagnostics,
      });
    }

    // 5. 응답 파싱
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = responseText;
    }

    diagnostics.push(`[11] 발송 완료!`);

    // sms_logs에 기록 (발송 건수 카운트용)
    try {
      await supabase.from("sms_logs").insert({
        recipient: cleanPhone,
        message: testMessage,
      });
    } catch {
      // 테이블 없으면 무시
    }

    return NextResponse.json({
      success: true,
      response: parsed,
      diagnostics,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `서버 에러: ${String(error)}`,
      diagnostics: [`에러: ${String(error)}`],
    });
  }
}

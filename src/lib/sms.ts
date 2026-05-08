/**
 * CoolSMS 문자 발송 유틸리티
 * - 무료 모드: 일일 50건 제한
 * - 유료 모드: 무제한
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { FEATURE_FLAGS } from "./feature-flags";

const COOLSMS_API_URL = "https://api.coolsms.co.kr/messages/v4/send-many/detail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SmsMessage {
  to: string;
  text: string;
}

interface SmsResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

function getAuthHeader(): string {
  const apiKey = process.env.COOLSMS_API_KEY!;
  const apiSecret = process.env.COOLSMS_API_SECRET!;

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * 오늘 발송 건수 조회
 */
async function getTodaySentCount(): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("sms_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", today.toISOString());

    if (error) {
      console.warn("[SMS] sms_logs 조회 실패 (테이블 미생성?):", error.message);
      return 0;
    }

    return count || 0;
  } catch (e) {
    console.warn("[SMS] getTodaySentCount 에러:", e);
    return 0;
  }
}

/**
 * SMS 설정 조회 (무료/유료 모드)
 */
async function getSmsSettings(): Promise<{ mode: "free" | "paid"; daily_limit: number }> {
  try {
    const { data, error } = await supabase
      .from("sms_settings")
      .select("mode, daily_limit")
      .eq("id", "default")
      .single();

    if (error) {
      console.warn("[SMS] sms_settings 조회 실패 (테이블 미생성?):", error.message);
      return { mode: "free", daily_limit: 50 };
    }

    return data || { mode: "free", daily_limit: 50 };
  } catch (e) {
    console.warn("[SMS] getSmsSettings 에러:", e);
    return { mode: "free", daily_limit: 50 };
  }
}

/**
 * 발송 로그 기록
 */
async function logSmsSent(messages: SmsMessage[]) {
  try {
    const logs = messages.map((msg) => ({
      recipient: msg.to,
      message: msg.text,
    }));

    const { error } = await supabase.from("sms_logs").insert(logs);
    if (error) {
      console.warn("[SMS] 로그 기록 실패 (테이블 미생성?):", error.message);
    }
  } catch (e) {
    console.warn("[SMS] logSmsSent 에러:", e);
  }
}

export async function sendSms(messages: SmsMessage[]): Promise<SmsResult> {
  // Feature flag: SMS 기능 잠금 시 발송 자체를 차단
  if (!FEATURE_FLAGS.SMS_ENABLED) {
    console.log("[SMS] FEATURE_FLAGS.SMS_ENABLED=false - 발송 건너뜀");
    return { success: false, error: "SMS 기능 비활성화", skipped: true };
  }

  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  const sender = process.env.COOLSMS_SENDER;

  if (!apiKey || !apiSecret || !sender) {
    console.log("[SMS] CoolSMS 환경변수 미설정 - 발송 건너뜀");
    return { success: false, error: "SMS 환경변수 미설정" };
  }

  // 무료/유료 모드 체크
  const settings = await getSmsSettings();

  if (settings.mode === "free") {
    const todayCount = await getTodaySentCount();
    const remaining = settings.daily_limit - todayCount;

    if (remaining <= 0) {
      console.log(`[SMS] 무료 일일 한도(${settings.daily_limit}건) 초과 - 발송 중단`);
      return { success: false, error: "일일 무료 발송 한도 초과", skipped: true };
    }

    // 한도 내에서만 발송
    if (messages.length > remaining) {
      messages = messages.slice(0, remaining);
      console.log(`[SMS] 무료 한도 내 ${remaining}건만 발송`);
    }
  }

  try {
    const authorization = getAuthHeader();

    const response = await fetch(COOLSMS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        messages: messages.map((msg) => ({
          to: msg.to.replace(/-/g, ""),
          from: sender.replace(/-/g, ""),
          text: msg.text,
          type: msg.text.length > 90 ? "LMS" : "SMS",
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[SMS] 발송 실패:", err);
      return { success: false, error: err };
    }

    // 발송 로그 기록
    await logSmsSent(messages);

    console.log(`[SMS] ${messages.length}건 발송 성공`);
    return { success: true };
  } catch (error) {
    console.error("[SMS] 발송 에러:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendSmsToOne(to: string, text: string): Promise<SmsResult> {
  return sendSms([{ to, text }]);
}

/**
 * SMS 알림 서비스
 * - 최종 승인 시 → 예약자에게 SMS
 * - 메시지 템플릿은 DB(sms_settings.message_template)에서 읽음
 */

import { createClient } from "@supabase/supabase-js";
import { sendSms } from "./sms";
import { FEATURE_FLAGS } from "./feature-flags";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_TEMPLATE = "[차량부] 예약 승인 완료\n차량: {vehicle}\n기간: {start}~{end}\n안전 운행하세요!";

interface ReservationInfo {
  guest_name: string;
  phone: string;
  department: string;
  vehicle_name: string;
  start_date: string;
  end_date: string;
}

/**
 * DB에서 메시지 템플릿 조회
 */
async function getMessageTemplate(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("sms_settings")
      .select("message_template")
      .eq("id", "default")
      .single();

    if (error || !data?.message_template) {
      return DEFAULT_TEMPLATE;
    }
    return data.message_template;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

/**
 * 템플릿에 변수 치환
 */
function buildMessage(template: string, reservation: ReservationInfo): string {
  return template
    .replace(/\{name\}/g, reservation.guest_name)
    .replace(/\{vehicle\}/g, reservation.vehicle_name)
    .replace(/\{start\}/g, reservation.start_date)
    .replace(/\{end\}/g, reservation.end_date)
    .replace(/\{department\}/g, reservation.department)
    .replace(/\{phone\}/g, reservation.phone)
    .replace(/\\n/g, "\n");
}

/**
 * 최종 승인 완료 시 → 예약자에게 SMS
 */
export async function notifyUserApproved(reservation: ReservationInfo) {
  // Feature flag: SMS 잠금 시 알림 함수 진입 자체를 막음 (이중 안전장치)
  if (!FEATURE_FLAGS.SMS_ENABLED) {
    console.log("[SMS] FEATURE_FLAGS.SMS_ENABLED=false - 알림 발송 건너뜀");
    return;
  }

  console.log("[SMS] notifyUserApproved 호출:", reservation.guest_name, reservation.phone);

  if (!reservation.phone) {
    console.log("[SMS] 전화번호 없음 - 발송 중단");
    return;
  }

  const template = await getMessageTemplate();
  const message = buildMessage(template, reservation);

  console.log("[SMS] 발송 메시지:", message);

  const result = await sendSms([
    {
      to: reservation.phone,
      text: message,
    },
  ]);

  console.log("[SMS] 발송 결과:", JSON.stringify(result));
}

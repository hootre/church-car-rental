/**
 * SMS 알림 서비스
 * - 예약 신청 시 → 관리자들에게 SMS
 * - 최종 승인 시 → 예약자에게 SMS
 */

import { createClient } from "@supabase/supabase-js";
import { sendSms } from "./sms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReservationInfo {
  guest_name: string;
  phone: string;
  department: string;
  vehicle_name: string;
  start_date: string;
  end_date: string;
}

/**
 * 예약 신청 시 → 관리자들에게 SMS
 */
export async function notifyAdminsNewReservation(reservation: ReservationInfo) {
  // 활성화된 관리자 중 전화번호 있는 사람만
  const { data: admins } = await supabase
    .from("admins")
    .select("id, name, phone")
    .eq("is_active", true)
    .not("phone", "is", null);

  if (!admins || admins.length === 0) {
    console.log("[SMS] 전화번호 등록된 관리자 없음 - 발송 건너뜀");
    return;
  }

  const smsTargets = admins
    .filter((a) => a.phone)
    .map((a) => ({
      to: a.phone!,
      text: `[차량부] 새 예약 신청\n${reservation.guest_name}(${reservation.department})\n차량: ${reservation.vehicle_name}\n기간: ${reservation.start_date}~${reservation.end_date}\n승인 바랍니다.`,
    }));

  if (smsTargets.length > 0) {
    await sendSms(smsTargets);
  }
}

/**
 * 최종 승인 완료 시 → 예약자에게 SMS
 */
export async function notifyUserApproved(reservation: ReservationInfo) {
  if (!reservation.phone) return;

  await sendSms([
    {
      to: reservation.phone,
      text: `[차량부] 예약 승인 완료\n차량: ${reservation.vehicle_name}\n기간: ${reservation.start_date}~${reservation.end_date}\n안전 운행하세요!`,
    },
  ]);
}

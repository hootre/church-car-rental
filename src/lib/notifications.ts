/**
 * SMS 알림 서비스
 * - 최종 승인 시 → 예약자에게 SMS
 */

import { sendSms } from "./sms";

interface ReservationInfo {
  guest_name: string;
  phone: string;
  department: string;
  vehicle_name: string;
  start_date: string;
  end_date: string;
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

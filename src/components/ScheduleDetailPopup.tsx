"use client";

import StatusBadge from "@/components/StatusBadge";
import { Reservation } from "@/lib/supabase";

interface Props {
  reservation: Reservation;
  onClose: () => void;
}

/**
 * 공개 일정용 읽기 전용 예약 상세 팝업
 * - 관리자 기능(상태 변경/일정 편집) 없음
 * - 연락처 등 개인정보는 표시하지 않음
 */
export default function ScheduleDetailPopup({ reservation: r, onClose }: Props) {
  const sameDay = r.start_date === r.end_date;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{r.vehicles?.name || "차량"}</h3>
            <p className="text-xs text-gray-400 mt-0.5">예약 일정</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={r.status} />
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="닫기"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2">이용 일정</h4>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
              {sameDay ? (
                <>
                  <Row label="날짜" value={formatDate(r.start_date)} />
                  <Row label="시간" value={`${r.start_time?.slice(0, 5)} ~ ${r.end_time?.slice(0, 5)}`} />
                </>
              ) : (
                <>
                  <Row label="대여" value={`${formatDate(r.start_date)} ${r.start_time?.slice(0, 5)}`} />
                  <Row label="반납" value={`${formatDate(r.end_date)} ${r.end_time?.slice(0, 5)}`} />
                </>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2">예약 정보</h4>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
              <Row label="소속" value={r.department} />
              <Row label="신청자" value={r.guest_name} />
              {r.destination && <Row label="행선지" value={r.destination} />}
              {r.purpose && <Row label="사유" value={r.purpose} />}
              {r.passenger_count ? <Row label="탑승인원" value={`${r.passenger_count}명`} /> : null}
            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            연락처 등 개인정보는 표시되지 않습니다
          </p>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right break-keep">{value}</span>
    </div>
  );
}

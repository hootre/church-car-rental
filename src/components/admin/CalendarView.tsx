"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import { supabase, Reservation, statusLabel, statusColor } from "@/lib/supabase";

// 요일 이름
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 상태별 캘린더 도트 색상
const dotColor: Record<string, string> = {
  pending: "bg-yellow-400",
  staff_approved: "bg-emerald-400",
  approved: "bg-green-400",
  in_use: "bg-blue-400",
  returned: "bg-purple-400",
  rejected: "bg-red-300",
  cancelled: "bg-orange-300",
};

// 상태별 이벤트 바 색상 (데스크탑용 - 고채도)
const barColor: Record<string, string> = {
  pending: "bg-yellow-300 text-yellow-900",
  staff_approved: "bg-emerald-300 text-emerald-900",
  approved: "bg-green-400 text-green-900",
  in_use: "bg-blue-300 text-blue-900",
  returned: "bg-purple-300 text-purple-900",
  rejected: "bg-red-300 text-red-900",
  cancelled: "bg-orange-300 text-orange-900",
};

interface EventBar {
  id: string;
  reservation: Reservation;
  startCol: number;
  endCol: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popupReservation, setPopupReservation] = useState<Reservation | null>(null);
  const [dayListDate, setDayListDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 해당 월 예약 불러오기
  const fetchReservations = useCallback(async () => {
    setLoading(true);

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    const calStart = new Date(startOfMonth);
    calStart.setDate(calStart.getDate() - startOfMonth.getDay());
    const calEnd = new Date(endOfMonth);
    calEnd.setDate(calEnd.getDate() + (6 - endOfMonth.getDay()));

    const startStr = calStart.toISOString().split("T")[0];
    const endStr = calEnd.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("reservations")
      .select("*, vehicles(*)")
      .or(`start_date.lte.${endStr},end_date.gte.${startStr}`)
      .order("start_time", { ascending: true });

    setLoading(false);

    if (error) {
      toast.error("일정을 불러오지 못했습니다");
      console.error(error);
    } else {
      setReservations((data || []).filter((r) => r.status !== "cancelled"));
    }
  }, [year, month]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // 날짜별 예약 매핑
  const reservationsByDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};

    reservations.forEach((r) => {
      const start = new Date(r.start_date + "T00:00:00");
      const end = new Date(r.end_date + "T00:00:00");

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        if (!map[key]) map[key] = [];
        map[key].push(r);
      }
    });

    return map;
  }, [reservations]);

  // 달력 날짜 그리드 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      const d = new Date(year, month, -firstDay.getDay() + i + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // 각 주별 이벤트 바 계산
  const weekEventBars = useMemo(() => {
    const allBars: EventBar[][] = [];

    for (let weekIdx = 0; weekIdx < 6; weekIdx++) {
      const weekStart = weekIdx * 7;
      const weekDays = calendarDays.slice(weekStart, weekStart + 7);

      // 이 주와 겹치는 모든 예약 찾기
      const seen = new Set<string>();
      const intersecting: Reservation[] = [];

      weekDays.forEach((day) => {
        const dateStr = day.date.toISOString().split("T")[0];
        const dayRes = reservationsByDate[dateStr] || [];
        dayRes.forEach((r) => {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            intersecting.push(r);
          }
        });
      });

      // 일정이 긴 것부터 먼저 배치 (기간 내림차순, 같으면 시작일 오름차순)
      intersecting.sort((a, b) => {
        const aDays = Math.round((new Date(a.end_date + "T00:00:00").getTime() - new Date(a.start_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
        const bDays = Math.round((new Date(b.end_date + "T00:00:00").getTime() - new Date(b.start_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
        if (bDays !== aDays) return bDays - aDays;
        return a.start_date.localeCompare(b.start_date);
      });

      // 각 예약에 대해 바 정보 계산
      const weekBars: EventBar[] = [];

      intersecting.forEach((reservation) => {
        const resStart = new Date(reservation.start_date + "T00:00:00");
        const resEnd = new Date(reservation.end_date + "T00:00:00");
        const weekStartDate = weekDays[0].date;
        const weekEndDate = weekDays[6].date;

        let startCol = 0;
        let endCol = 6;
        let isStart = false;
        let isEnd = false;

        if (resStart >= weekStartDate && resStart <= weekEndDate) {
          startCol = Math.round((resStart.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24));
          isStart = true;
        }

        if (resEnd >= weekStartDate && resEnd <= weekEndDate) {
          endCol = Math.round((resEnd.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24));
          isEnd = true;
        }

        // 레인 할당
        let lane = 0;
        let assigned = false;

        while (!assigned) {
          let conflict = false;
          for (const existing of weekBars) {
            if (existing.lane === lane) {
              if (!(existing.endCol < startCol || existing.startCol > endCol)) {
                conflict = true;
                break;
              }
            }
          }
          if (!conflict) {
            assigned = true;
          } else {
            lane++;
          }
        }

        weekBars.push({
          id: reservation.id,
          reservation,
          startCol,
          endCol,
          lane,
          isStart,
          isEnd,
        });
      });

      allBars.push(weekBars);
    }

    return allBars;
  }, [calendarDays, reservationsByDate]);

  function goToPrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  }

  function goToNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  }

  function goToToday() {
    setCurrentDate(new Date());
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const selectedReservations = selectedDate
    ? reservationsByDate[selectedDate] || []
    : [];

  return (
    <div>
      {/* 달력 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900">
            {year}년 {month + 1}월
          </h3>
          <button
            onClick={goToToday}
            className="text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded-lg
                       hover:bg-primary-100 transition-colors font-medium"
          >
            오늘
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={goToPrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       hover:bg-gray-100 transition-colors text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       hover:bg-gray-100 transition-colors text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(statusLabel).filter(([key]) => key !== "cancelled").map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${dotColor[key]}`} />
            <span className="text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="card !p-0 mb-4 overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-2 px-1
                ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}
              `}
            >
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
        ) : (
          <div>
            {/* 주 단위로 렌더링 */}
            {Array.from({ length: 6 }).map((_, weekIdx) => {
              const weekDays = calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7);
              const bars = weekEventBars[weekIdx] || [];
              const maxLane = bars.length > 0 ? Math.max(...bars.map((b) => b.lane)) : -1;
              const barLaneCount = Math.min(maxLane + 1, 3); // 최대 3줄까지 표시

              return (
                <div key={weekIdx}>
                  {/* 날짜 행 */}
                  <div className="grid grid-cols-7">
                    {weekDays.map((dayInfo, colIdx) => {
                      const { date, isCurrentMonth } = dayInfo;
                      const dateStr = date.toISOString().split("T")[0];
                      const dayReservations = reservationsByDate[dateStr] || [];
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDate;
                      const dayOfWeek = date.getDay();

                      return (
                        <button
                          key={colIdx}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          className={`relative p-1.5 md:p-2 min-h-[44px] md:min-h-[36px] border-r border-b border-gray-200
                                      flex flex-col items-center transition-colors
                                      ${isCurrentMonth ? "" : "opacity-30 bg-gray-50"}
                                      ${isSelected ? "bg-primary-50" : "hover:bg-gray-50"}
                                      ${colIdx === 6 ? "border-r-0" : ""}
                          `}
                        >
                          <span
                            className={`text-xs md:text-sm leading-none px-1.5 py-0.5 rounded-full
                              ${isToday ? "bg-primary-600 text-white font-bold" : ""}
                              ${!isToday && dayOfWeek === 0 ? "text-red-400" : ""}
                              ${!isToday && dayOfWeek === 6 ? "text-blue-400" : ""}
                              ${!isToday && dayOfWeek !== 0 && dayOfWeek !== 6 ? "text-gray-700" : ""}
                            `}
                          >
                            {date.getDate()}
                          </span>

                          {/* 모바일: 도트 표시 */}
                          {dayReservations.length > 0 && (
                            <div className="md:hidden flex flex-wrap gap-[2px] mt-1 justify-center">
                              {dayReservations.length <= 3 ? (
                                dayReservations.map((r, i) => (
                                  <div
                                    key={i}
                                    className={`w-[5px] h-[5px] rounded-full ${dotColor[r.status] || "bg-gray-300"}`}
                                  />
                                ))
                              ) : (
                                <>
                                  <div className={`w-[5px] h-[5px] rounded-full ${dotColor[dayReservations[0].status]}`} />
                                  <div className={`w-[5px] h-[5px] rounded-full ${dotColor[dayReservations[1].status]}`} />
                                  <span
                                    className="text-[8px] text-primary-500 font-bold leading-none"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDayListDate(dateStr);
                                    }}
                                  >
                                    +{dayReservations.length - 2}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 데스크탑: 이벤트 바 영역 (항상 최소 높이 확보) */}
                  {(() => {
                    // 각 열(요일)별 실제 초과 예약 수 계산
                    // = 해당 날짜 총 예약 수 - 해당 열에서 보이는 바(lane<3) 수
                    const overflowByCol: number[] = [0, 0, 0, 0, 0, 0, 0];
                    weekDays.forEach((dayInfo, col) => {
                      const dateStr = dayInfo.date.toISOString().split("T")[0];
                      const totalForDay = (reservationsByDate[dateStr] || []).length;
                      const visibleForCol = bars.filter(
                        (bar) => bar.lane < 3 && bar.startCol <= col && bar.endCol >= col
                      ).length;
                      overflowByCol[col] = Math.max(totalForDay - visibleForCol, 0);
                    });
                    const hasOverflow = overflowByCol.some((v) => v > 0);
                    const totalHeight = Math.max(barLaneCount * 26 + 6, 52) + (hasOverflow ? 20 : 0);

                    return (
                      <div
                        className="hidden md:block relative border-b border-gray-200"
                        style={{ height: `${totalHeight}px` }}
                      >
                        {/* 세로 격자선 */}
                        {[1, 2, 3, 4, 5, 6].map((col) => (
                          <div
                            key={`vline-${col}`}
                            className="absolute top-0 bottom-0 border-l border-gray-200"
                            style={{ left: `${(col / 7) * 100}%` }}
                          />
                        ))}
                        {bars
                          .filter((bar) => bar.lane < 3)
                          .map((bar) => {
                            const span = bar.endCol - bar.startCol + 1;
                            const leftPercent = (bar.startCol / 7) * 100;
                            const widthPercent = (span / 7) * 100;

                            let roundedClass = "rounded";
                            if (bar.isStart && bar.isEnd) roundedClass = "rounded";
                            else if (bar.isStart && !bar.isEnd) roundedClass = "rounded-l";
                            else if (!bar.isStart && bar.isEnd) roundedClass = "rounded-r";
                            else roundedClass = "rounded-none";

                            return (
                              <button
                                key={bar.id}
                                onClick={() => setPopupReservation(bar.reservation)}
                                className={`absolute h-[22px] flex items-center px-2 text-[11px] font-medium truncate
                                  cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity
                                  ${barColor[bar.reservation.status] || "bg-gray-300 text-gray-700"}
                                  ${roundedClass}
                                `}
                                style={{
                                  top: `${bar.lane * 26 + 4}px`,
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                                title={`${bar.reservation.vehicles?.name || "차량"} - ${bar.reservation.department} ${bar.reservation.guest_name} (${bar.reservation.start_date} ~ ${bar.reservation.end_date})`}
                              >
                                {bar.reservation.vehicles?.name} {bar.reservation.department} {bar.reservation.guest_name}
                              </button>
                            );
                          })}
                        {/* 열별 +더보기 버튼 */}
                        {overflowByCol.map((count, col) => {
                          if (count === 0) return null;
                          const colDateStr = weekDays[col].date.toISOString().split("T")[0];
                          return (
                            <button
                              key={`more-${col}`}
                              onClick={() => setDayListDate(colDateStr)}
                              className="absolute text-[10px] text-primary-500 font-semibold hover:text-primary-700 hover:underline transition-colors truncate px-1"
                              style={{
                                top: `${3 * 26 + 4}px`,
                                left: `${(col / 7) * 100}%`,
                                width: `${(1 / 7) * 100}%`,
                              }}
                            >
                              +{count} 더보기
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 일정 상세 팝업 */}
      {popupReservation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPopupReservation(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* 팝업 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-bold text-gray-900">예약 상세</h3>
              <button
                onClick={() => setPopupReservation(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* 차량 + 상태 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${dotColor[popupReservation.status]}`} />
                  <span className="font-bold text-lg text-gray-900">{popupReservation.vehicles?.name || "차량"}</span>
                </div>
                <StatusBadge status={popupReservation.status} />
              </div>

              {/* 기본 정보 */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                <PopupRow label="신청자" value={`${popupReservation.guest_name} (${popupReservation.department})`} />
                <PopupRow label="연락처" value={popupReservation.phone} />
                <PopupRow
                  label="사용기간"
                  value={
                    popupReservation.start_date === popupReservation.end_date
                      ? `${popupReservation.start_date} ${popupReservation.start_time?.slice(0, 5)} ~ ${popupReservation.end_time?.slice(0, 5)}`
                      : `${popupReservation.start_date} ${popupReservation.start_time?.slice(0, 5)} ~ ${popupReservation.end_date} ${popupReservation.end_time?.slice(0, 5)}`
                  }
                />
                {popupReservation.purpose && <PopupRow label="사용목적" value={popupReservation.purpose} />}
                {popupReservation.destination && <PopupRow label="행선지" value={popupReservation.destination} />}
                {popupReservation.passenger_count && <PopupRow label="탑승인원" value={`${popupReservation.passenger_count}명`} />}
                {popupReservation.driver_name && <PopupRow label="운전자" value={popupReservation.driver_name} />}
              </div>

              {/* 승인 현황 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-700 mb-2">승인 현황</p>
                <div className="flex gap-3">
                  <div className="flex-1 text-center">
                    <div className={`text-xs font-bold ${popupReservation.staff_approved_at ? "text-emerald-600" : "text-gray-300"}`}>
                      {popupReservation.staff_approved_at ? "✓ 승인" : "⏳ 대기"}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">차량담당 장로</div>
                    {popupReservation.staff_approved_at && (
                      <div className="text-[10px] text-gray-400">
                        {new Date(popupReservation.staff_approved_at).toLocaleDateString("ko-KR")}
                      </div>
                    )}
                  </div>
                  <div className="w-px bg-gray-200" />
                  <div className="flex-1 text-center">
                    <div className={`text-xs font-bold ${popupReservation.manager_approved_at ? "text-green-600" : "text-gray-300"}`}>
                      {popupReservation.manager_approved_at ? "✓ 승인" : "⏳ 대기"}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">기획장로</div>
                    {popupReservation.manager_approved_at && (
                      <div className="text-[10px] text-gray-400">
                        {new Date(popupReservation.manager_approved_at).toLocaleDateString("ko-KR")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 처리 시각 */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                <PopupRow label="신청일" value={new Date(popupReservation.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
                {popupReservation.picked_up_at && (
                  <PopupRow label="대여 시작" value={new Date(popupReservation.picked_up_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
                )}
                {popupReservation.returned_at && (
                  <PopupRow label="반납 완료" value={new Date(popupReservation.returned_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
                )}
              </div>

              {/* 관리자 메모 */}
              {popupReservation.admin_note && (
                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-yellow-700 mb-1">관리자 메모</p>
                  <p className="text-sm text-yellow-800">{popupReservation.admin_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 날짜별 일정 목록 팝업 */}
      {dayListDate && (() => {
        const dayRes = reservationsByDate[dayListDate] || [];
        const dateObj = new Date(dayListDate + "T00:00:00");
        const dateLabel = dateObj.toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
          weekday: "short",
        });

        return (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setDayListDate(null)}
          >
            <div
              className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] sm:max-h-[80vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                <div>
                  <h3 className="font-bold text-gray-900">{dateLabel}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{dayRes.length}건의 예약</p>
                </div>
                <button
                  onClick={() => setDayListDate(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 예약 리스트 */}
              <div className="px-4 py-3 space-y-2">
                {dayRes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">이 날짜에 예약이 없습니다</div>
                ) : (
                  dayRes.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setDayListDate(null);
                        setPopupReservation(r);
                      }}
                      className="w-full text-left bg-gray-50 rounded-xl p-3 hover:bg-gray-100 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor[r.status]}`} />
                          <span className="font-bold text-sm text-gray-900 truncate">
                            {r.vehicles?.name}
                          </span>
                          <StatusBadge status={r.status} />
                        </div>
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5 pl-[18px]">
                        <div className="flex justify-between gap-3">
                          <span>{r.guest_name} ({r.department})</span>
                          <span className="text-gray-400 shrink-0">
                            {r.start_time?.slice(0, 5)} ~ {r.end_time?.slice(0, 5)}
                          </span>
                        </div>
                        {r.destination && (
                          <div className="text-gray-400 truncate">행선지: {r.destination}</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 이번 달 요약 */}
      {!selectedDate && (
        <MonthSummary reservations={reservations} />
      )}

      {/* 선택된 날짜의 예약 상세 */}
      {selectedDate && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-900 text-sm">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </h4>
            <span className="text-xs text-gray-400">
              {selectedReservations.length}건
            </span>
          </div>

          {selectedReservations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">이 날짜에 예약이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedReservations.map((r) => (
                <div key={r.id} className="card !p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${dotColor[r.status]}`} />
                      <h5 className="font-bold text-sm text-gray-900">
                        {r.vehicles?.name}
                      </h5>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="space-y-0.5 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>신청자</span>
                      <span className="text-gray-900">{r.guest_name} ({r.department})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>시간</span>
                      <span className="text-gray-900">
                        {r.start_date === r.end_date
                          ? `${r.start_time?.slice(0, 5)} ~ ${r.end_time?.slice(0, 5)}`
                          : `${r.start_date} ${r.start_time?.slice(0, 5)} ~ ${r.end_date} ${r.end_time?.slice(0, 5)}`}
                      </span>
                    </div>
                    {r.destination && (
                      <div className="flex justify-between">
                        <span>행선지</span>
                        <span className="text-gray-900">{r.destination}</span>
                      </div>
                    )}
                    {r.purpose && (
                      <div className="flex justify-between">
                        <span>사유</span>
                        <span className="text-gray-900">{r.purpose}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>연락처</span>
                      <span className="text-gray-900">{r.phone}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 이번 달 요약 컴포넌트
function MonthSummary({ reservations }: { reservations: Reservation[] }) {
  const stats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === "pending").length,
    staff_approved: reservations.filter((r) => r.status === "staff_approved").length,
    approved: reservations.filter((r) => r.status === "approved").length,
    in_use: reservations.filter((r) => r.status === "in_use").length,
    returned: reservations.filter((r) => r.status === "returned").length,
  };

  const deptCount: Record<string, { name: string; count: number }> = {};
  reservations
    .filter((r) => r.status !== "rejected")
    .forEach((r) => {
      const dept = r.department || "미지정";
      if (!deptCount[dept]) deptCount[dept] = { name: dept, count: 0 };
      deptCount[dept].count++;
    });

  const topDepts = Object.values(deptCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (stats.total === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-400 text-sm">이번 달 예약이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-gray-900 text-sm">이번 달 요약</h4>

      <div className="grid grid-cols-3 gap-1.5">
        <MiniStat label="담당장로" count={stats.pending} />
        <MiniStat label="기획장로" count={stats.staff_approved} />
        <MiniStat label="승인완료" count={stats.approved} />
        <MiniStat label="대여중" count={stats.in_use} />
        <MiniStat label="반납완료" count={stats.returned} />
        <MiniStat label="전체" count={stats.total} />
      </div>

      {topDepts.length > 0 && (
        <div className="card !p-3">
          <p className="text-xs text-gray-500 mb-2">대여 많은 부서</p>
          <div className="space-y-1.5">
            {topDepts.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-900">{d.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-400 rounded-full"
                      style={{
                        width: `${Math.round((d.count / stats.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500">{d.count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <div className="text-lg font-bold text-gray-900">{count}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function PopupRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs text-gray-900 text-right">{value}</span>
    </div>
  );
}

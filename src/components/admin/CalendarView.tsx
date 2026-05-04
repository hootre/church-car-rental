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
};

// 상태별 이벤트 태그 배경색
const eventPillColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  staff_approved: "bg-emerald-100 text-emerald-700",
  approved: "bg-green-100 text-green-700",
  in_use: "bg-blue-100 text-blue-700",
  returned: "bg-purple-100 text-purple-700",
  rejected: "bg-red-100 text-red-700",
};

interface EventBar {
  id: string;
  reservation: Reservation;
  startCol: number;
  endCol: number;
  lane: number;
  startsInWeek: boolean;
  endsInWeek: boolean;
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      setReservations(data || []);
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
    const bars: EventBar[][] = [];

    for (let weekIdx = 0; weekIdx < calendarDays.length / 7; weekIdx++) {
      const weekStart = weekIdx * 7;
      const weekEnd = weekStart + 7;
      const weekDays = calendarDays.slice(weekStart, weekEnd);

      // 이 주와 겹치는 모든 예약 찾기
      const intersectingReservations = new Set<Reservation>();

      weekDays.forEach((day) => {
        const dateStr = day.date.toISOString().split("T")[0];
        const dayResevations = reservationsByDate[dateStr] || [];
        dayResevations.forEach((r) => intersectingReservations.add(r));
      });

      // 각 예약에 대해 시작/종료 열 계산 및 레인 할당
      const weekBars: EventBar[] = [];
      const laneMap = new Map<string, number>();

      Array.from(intersectingReservations).forEach((reservation) => {
        const resStart = new Date(reservation.start_date + "T00:00:00");
        const resEnd = new Date(reservation.end_date + "T00:00:00");
        const weekStartDate = weekDays[0].date;
        const weekEndDate = weekDays[6].date;

        // 이 주에서의 시작/종료 열
        let startCol = 0;
        let endCol = 6;
        let startsInWeek = false;
        let endsInWeek = false;

        if (resStart >= weekStartDate && resStart <= weekEndDate) {
          startCol = resStart.getDay();
          startsInWeek = true;
        }

        if (resEnd >= weekStartDate && resEnd <= weekEndDate) {
          endCol = resEnd.getDay();
          endsInWeek = true;
        }

        if (resStart < weekStartDate) {
          startCol = 0;
        }

        if (resEnd > weekEndDate) {
          endCol = 6;
        }

        // 레인 할당 (겹치는 다른 바들과의 충돌 확인)
        let lane = 0;
        let assigned = false;

        while (!assigned) {
          let conflict = false;

          for (const existingBar of weekBars) {
            if (existingBar.lane === lane) {
              // 이 레인의 다른 바와 겹치는지 확인
              if (
                !(existingBar.endCol < startCol || existingBar.startCol > endCol)
              ) {
                conflict = true;
                break;
              }
            }
          }

          if (!conflict) {
            assigned = true;
            laneMap.set(reservation.id, lane);
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
          startsInWeek,
          endsInWeek,
        });
      });

      bars.push(weekBars);
    }

    return bars;
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
        {Object.entries(statusLabel).map(([key, label]) => (
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
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth }, idx) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayReservations = reservationsByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayOfWeek = date.getDay();
              const weekIdx = Math.floor(idx / 7);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`relative p-2 md:p-3 min-h-[52px] md:min-h-[100px] border-r border-b border-gray-200
                              flex flex-col items-start transition-colors
                              ${isCurrentMonth ? "" : "opacity-30 bg-gray-50"}
                              ${isSelected ? "bg-primary-50" : "hover:bg-gray-50"}
                              ${
                                idx % 7 === 6 ? "border-r-0" : ""
                              }
                              ${idx + 7 > calendarDays.length - 1 ? "border-b-0" : ""}
                  `}
                >
                  {/* 날짜 번호 */}
                  <div className="mb-1 md:mb-2 w-full">
                    <span
                      className={`inline-flex text-xs md:text-sm leading-none px-1.5 py-0.5 rounded-full
                        ${isToday ? "bg-primary-600 text-white font-bold" : ""}
                        ${!isToday && dayOfWeek === 0 ? "text-red-400" : ""}
                        ${!isToday && dayOfWeek === 6 ? "text-blue-400" : ""}
                        ${!isToday && dayOfWeek !== 0 && dayOfWeek !== 6 ? "text-gray-700" : ""}
                      `}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* 모바일: 도트 표시 */}
                  {dayReservations.length > 0 && (
                    <div className="md:hidden flex flex-wrap gap-[2px] w-full">
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
                          <span className="text-[8px] text-gray-400 leading-none">
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
        )}
      </div>

      {/* 데스크탑: 멀티데이 예약 바 오버레이 */}
      <div className="hidden md:block mb-4 space-y-2">
        {weekEventBars.map((weekBars, weekIdx) => {
          const weekStart = weekIdx * 7;
          const visibleBars = weekBars.slice(0, 3);
          const hiddenCount = weekBars.length > 3 ? weekBars.length - 3 : 0;

          return (
            <div key={`week-${weekIdx}`} className="space-y-1">
              {visibleBars.map((bar) => {
                const widthPercent = ((bar.endCol - bar.startCol + 1) / 7) * 100;
                const leftPercent = (bar.startCol / 7) * 100;

                let borderRadius = "rounded";
                if (bar.startsInWeek && bar.endsInWeek) {
                  borderRadius = "rounded";
                } else if (bar.startsInWeek) {
                  borderRadius = "rounded-l";
                } else if (bar.endsInWeek) {
                  borderRadius = "rounded-r";
                } else {
                  borderRadius = "";
                }

                return (
                  <div
                    key={bar.id}
                    className="relative h-6 flex items-center"
                    style={{ paddingLeft: `${leftPercent}%` }}
                  >
                    <div
                      className={`h-5 flex items-center px-2 py-0.5 text-[10px] font-medium whitespace-nowrap overflow-hidden
                        ${eventPillColor[bar.reservation.status] || "bg-gray-100 text-gray-700"}
                        ${borderRadius}
                      `}
                      style={{ width: `${widthPercent}%` }}
                      title={`${bar.reservation.vehicles?.name || "차량"} ${bar.reservation.guest_name}`}
                    >
                      {bar.reservation.vehicles?.name} {bar.reservation.guest_name}
                    </div>
                  </div>
                );
              })}

              {hiddenCount > 0 && (
                <div className="text-[10px] text-gray-500 px-3 py-1">
                  +{hiddenCount} more
                </div>
              )}
            </div>
          );
        })}
      </div>

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

  const vehicleCount: Record<string, { name: string; count: number }> = {};
  reservations
    .filter((r) => r.status !== "rejected")
    .forEach((r) => {
      const name = r.vehicles?.name || "알 수 없음";
      if (!vehicleCount[name]) vehicleCount[name] = { name, count: 0 };
      vehicleCount[name].count++;
    });

  const topVehicles = Object.values(vehicleCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

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
        <MiniStat label="대기" count={stats.pending} />
        <MiniStat label="1차승인" count={stats.staff_approved} />
        <MiniStat label="승인완료" count={stats.approved} />
        <MiniStat label="대여중" count={stats.in_use} />
        <MiniStat label="반납" count={stats.returned} />
        <MiniStat label="전체" count={stats.total} />
      </div>

      {topVehicles.length > 0 && (
        <div className="card !p-3">
          <p className="text-xs text-gray-500 mb-2">인기 차량</p>
          <div className="space-y-1.5">
            {topVehicles.map((v, i) => (
              <div key={v.name} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-900">{v.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-400 rounded-full"
                      style={{
                        width: `${Math.round((v.count / stats.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500">{v.count}건</span>
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

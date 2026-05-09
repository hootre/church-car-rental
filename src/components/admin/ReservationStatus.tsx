"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import ReservationDetailModal from "@/components/admin/ReservationDetailModal";
import {
  supabase,
  Reservation,
  Admin,
  Vehicle,
} from "@/lib/supabase";

interface Props {
  adminId: string;
  adminRole: string;
}

// 한국시간 기준 "YYYY-MM-DD" / "HH:MM:SS" 문자열
function nowParts() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const timeStr = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Seoul",
    hour12: false,
  });
  return { dateStr, timeStr };
}

// 현재 시각이 [start, end] 구간에 들어 있는지
function isWithinPeriod(r: Reservation): boolean {
  const { dateStr, timeStr } = nowParts();
  const startedAlready =
    r.start_date < dateStr ||
    (r.start_date === dateStr && (r.start_time || "00:00:00") <= timeStr);
  const notEndedYet =
    r.end_date > dateStr ||
    (r.end_date === dateStr && (r.end_time || "23:59:59") >= timeStr);
  return startedAlready && notEndedYet;
}

// (정렬 키는 사용 일정 시간순으로 단순화 — 아래 fetchReservations 내부에서 적용)

export default function ReservationStatus({ adminId, adminRole }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  // 관리자 / 차량 목록 (모달에 전달)
  useEffect(() => {
    supabase.from("admins").select("*").then(({ data }) => {
      setAdmins(data || []);
    });
    supabase
      .from("vehicles")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => setVehicles(data || []));
  }, []);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*, vehicles(*), reservation_photos(*)")
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      toast.error("예약 목록을 불러오지 못했습니다");
      return null;
    }
    // 한국시간 기준 오늘 (YYYY-MM-DD)
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    // 1) cancelled 제외, 2) 오늘 이후만 (end_date >= today)
    const filtered = (data || []).filter(
      (r) => r.status !== "cancelled" && r.end_date >= todayStr
    );

    // 시간순 정렬 (start_date + start_time 기준 가까운 일정이 위)
    const sorted = filtered.sort((a, b) => {
      const aKey = `${a.start_date} ${a.start_time || "00:00:00"}`;
      const bKey = `${b.start_date} ${b.start_time || "00:00:00"}`;
      return aKey.localeCompare(bKey);
    });
    setReservations(sorted);
    return sorted;
  }, []);

  // approved + 현재 사용 기간 안 → in_use 자동 전환
  const syncInUseStatus = useCallback(async (rows: Reservation[]) => {
    const targets = rows.filter(
      (r) => r.status === "approved" && isWithinPeriod(r)
    );
    if (targets.length === 0) return false;

    const nowIso = new Date().toISOString();
    const updates = await Promise.all(
      targets.map((r) =>
        supabase
          .from("reservations")
          .update({ status: "in_use", picked_up_at: r.picked_up_at || nowIso })
          .eq("id", r.id)
          .eq("status", "approved")
      )
    );
    const changed = updates.filter((u) => !u.error).length;
    if (changed > 0) {
      toast.success(`${changed}건이 자동으로 '대여중'으로 전환되었습니다`);
    }
    return changed > 0;
  }, []);

  useEffect(() => {
    (async () => {
      const rows = await fetchReservations();
      if (rows) {
        const didSync = await syncInUseStatus(rows);
        if (didSync) await fetchReservations();
      }
    })();
  }, [fetchReservations, syncInUseStatus]);

  // 통계
  const stats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === "pending").length,
    staff_approved: reservations.filter((r) => r.status === "staff_approved").length,
    approved: reservations.filter((r) => r.status === "approved").length,
    in_use: reservations.filter((r) => r.status === "in_use").length,
    returned: reservations.filter((r) => r.status === "returned").length,
  };

  const filtered =
    filter === "all"
      ? reservations
      : reservations.filter((r) => r.status === filter);

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const todayItems = filtered.filter(
    (r) => r.start_date <= todayStr && r.end_date >= todayStr
  );
  const todayIds = new Set(todayItems.map((r) => r.id));
  const restItems = filtered.filter((r) => !todayIds.has(r.id));

  function groupByWeek(
    items: Reservation[]
  ): { key: string; label: string; items: Reservation[] }[] {
    const groups: Record<string, Reservation[]> = {};
    for (const r of items) {
      const date = new Date((r.start_date || r.created_at) + "T00:00:00");
      const day = date.getDay();
      const sun = new Date(date);
      sun.setDate(date.getDate() - day);
      const key = sun.toLocaleDateString("en-CA");
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups)
      // 가까운 주(일요일 날짜가 빠른 것)부터 위
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => {
        const sun = new Date(key + "T00:00:00");
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const label = `${sun.getMonth() + 1}/${sun.getDate()} ~ ${sat.getMonth() + 1}/${sat.getDate()}`;
        return { key, label, items };
      });
  }

  const weeklyGroups = groupByWeek(restItems);

  function toggleWeek(weekKey: string) {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  }

  return (
    <div>
      {/* 통계 카드 (필터 겸용) */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <StatCard label="1차 대기" count={stats.pending} bg="bg-yellow-50" color="text-yellow-700" subColor="text-yellow-600" active={filter === "pending"} onClick={() => setFilter(filter === "pending" ? "all" : "pending")} />
        <StatCard label="2차 대기" count={stats.staff_approved} bg="bg-orange-50" color="text-orange-700" subColor="text-orange-600" active={filter === "staff_approved"} onClick={() => setFilter(filter === "staff_approved" ? "all" : "staff_approved")} />
        <StatCard label="승인완료" count={stats.approved} bg="bg-green-50" color="text-green-700" subColor="text-green-600" active={filter === "approved"} onClick={() => setFilter(filter === "approved" ? "all" : "approved")} />
        <StatCard label="대여중" count={stats.in_use} bg="bg-blue-50" color="text-blue-700" subColor="text-blue-600" active={filter === "in_use"} onClick={() => setFilter(filter === "in_use" ? "all" : "in_use")} />
        <StatCard label="반납완료" count={stats.returned} bg="bg-purple-50" color="text-purple-700" subColor="text-purple-600" active={filter === "returned"} onClick={() => setFilter(filter === "returned" ? "all" : "returned")} />
        <StatCard label="전체" count={stats.total} bg="bg-gray-50" color="text-gray-700" subColor="text-gray-500" active={filter === "all"} onClick={() => setFilter("all")} />
      </div>

      {/* 예약 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">예약이 없습니다</div>
      ) : (
        <div className="space-y-3">
          {/* 오늘 섹션 */}
          {todayItems.length > 0 && (
            <div className="rounded-2xl overflow-hidden border-2 border-primary-200 bg-white">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-primary-50">
                <span className="text-sm">📌</span>
                <span className="text-sm font-bold text-primary-700">오늘</span>
                <span className="text-xs text-primary-500 font-medium">{todayItems.length}건</span>
              </div>
              <div className="divide-y divide-gray-100">
                {todayItems.map((r) => (
                  <ReservationRow key={r.id} r={r} onClick={() => setSelectedReservation(r)} />
                ))}
              </div>
            </div>
          )}

          {/* 주별 아코디언 */}
          {weeklyGroups.map((group) => {
            const isCollapsed = collapsedWeeks.has(group.key);
            return (
              <div key={group.key} className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                <button
                  onClick={() => toggleWeek(group.key)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-bold text-gray-700">{group.label}</span>
                    <span className="text-xs text-gray-400 font-medium">{group.items.length}건</span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {group.items.map((r) => (
                      <ReservationRow key={r.id} r={r} onClick={() => setSelectedReservation(r)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 공통 상세 모달 */}
      {selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          adminId={adminId}
          adminRole={adminRole}
          vehicles={vehicles}
          admins={admins}
          onClose={() => setSelectedReservation(null)}
          onUpdated={() => fetchReservations()}
        />
      )}
    </div>
  );
}

function StatCard({ label, count, bg, color, subColor, active, onClick }: {
  label: string; count: number; bg: string; color: string; subColor: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${bg} rounded-xl p-2.5 text-center transition-all cursor-pointer ${
        active ? "ring-2 ring-offset-1 ring-primary-500" : ""
      }`}
    >
      <div className={`text-lg font-bold ${color}`}>{count}</div>
      <div className={`text-[10px] leading-tight ${active ? subColor + " font-semibold" : "text-gray-500"}`}>{label}</div>
    </button>
  );
}

function ReservationRow({ r, onClick }: { r: Reservation; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left hover:bg-gray-50 transition-colors"
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">
              {r.vehicles?.type === "bus" ? "🚌" : r.vehicles?.type === "van" ? "🚐" : "🚗"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm text-gray-900 truncate">{r.vehicles?.name}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-gray-400 truncate">
                {r.guest_name} ({r.department}) · {r.start_date}
              </p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

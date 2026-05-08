"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import PhotoUpload from "@/components/PhotoUpload";
import {
  supabase, Reservation, Admin, Vehicle, statusLabel, statusColor,
  statusTransitions, statusRequiredRole,
} from "@/lib/supabase";

interface Props {
  adminId: string;
  adminRole: string;
}

// 한국시간 기준 "YYYY-MM-DD HH:MM:SS" 비교용 문자열
function nowParts() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const timeStr = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Seoul",
    hour12: false,
  }); // "HH:MM:SS"
  return { dateStr, timeStr };
}

// 현재 시각이 [start, end] 구간에 들어 있는지 (date+time 모두 비교)
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

export default function ReservationStatus({ adminId, adminRole }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [actionNote, setActionNote] = useState("");

  // 편집 모드 상태
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    vehicle_id: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // 관리자 / 차량 목록 조회
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

  // 관리자 이름 찾기
  function getAdminName(adminId: string | null): string {
    if (!adminId) return "";
    const admin = admins.find((a) => a.id === adminId);
    return admin ? admin.name : "";
  }

  const statusOrder: Record<string, number> = {
    pending: 0,
    staff_approved: 1,
    approved: 2,
    in_use: 3,
    returned: 4,
    cancelled: 5,
    rejected: 6,
  };

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
    const filtered = (data || []).filter((r) => r.status !== "cancelled");
    const sorted = filtered.sort((a, b) => {
      const diff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setReservations(sorted);
    return sorted;
  }, []);

  // approved 상태이면서 현재 시각이 사용 기간 안인 예약을 in_use 로 자동 전환
  const syncInUseStatus = useCallback(
    async (rows: Reservation[]) => {
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
            .eq("status", "approved") // 동시 변경 방지
        )
      );
      const changed = updates.filter((u) => !u.error).length;
      if (changed > 0) {
        toast.success(`${changed}건이 자동으로 '대여중'으로 전환되었습니다`);
      }
      return changed > 0;
    },
    []
  );

  useEffect(() => {
    (async () => {
      const rows = await fetchReservations();
      if (rows) {
        const didSync = await syncInUseStatus(rows);
        if (didSync) {
          // 동기화 후 최신 데이터로 다시 로드
          await fetchReservations();
        }
      }
    })();
  }, [fetchReservations, syncInUseStatus]);

  // 선택된 예약이 바뀌면 편집모드 초기화
  useEffect(() => {
    setEditMode(false);
  }, [selectedReservation?.id]);

  // 상태별 통계
  const stats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === "pending").length,
    staff_approved: reservations.filter((r) => r.status === "staff_approved").length,
    approved: reservations.filter((r) => r.status === "approved").length,
    in_use: reservations.filter((r) => r.status === "in_use").length,
    returned: reservations.filter((r) => r.status === "returned").length,
  };

  // 필터링
  const filtered =
    filter === "all"
      ? reservations
      : reservations.filter((r) => r.status === filter);

  // 오늘 날짜 (YYYY-MM-DD, 한국시간 기준)
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  // 오늘 해당 항목: 오늘이 대여기간에 포함되는 예약
  const todayItems = filtered.filter((r) => r.start_date <= todayStr && r.end_date >= todayStr);
  const todayIds = new Set(todayItems.map((r) => r.id));

  // 나머지 항목을 주별 그룹핑
  const restItems = filtered.filter((r) => !todayIds.has(r.id));

  // 주별 아코디언
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  function groupByWeek(items: Reservation[]): { key: string; label: string; items: Reservation[] }[] {
    const groups: Record<string, Reservation[]> = {};
    for (const r of items) {
      const date = new Date((r.start_date || r.created_at) + "T00:00:00");
      const day = date.getDay(); // 0=일
      const sun = new Date(date);
      sun.setDate(date.getDate() - day);
      const key = sun.toLocaleDateString("en-CA");
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
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

  // 상태 변경 가능 여부
  function canTransition(nextStatus: string): boolean {
    const requiredRoles = statusRequiredRole[nextStatus] || [];
    return requiredRoles.includes(adminRole);
  }

  // 상태 변경
  async function handleStatusChange(reservation: Reservation, nextStatus: string) {
    if (!canTransition(nextStatus)) {
      toast.error("이 작업을 수행할 권한이 없습니다");
      return;
    }

    // 확인 팝업
    const confirmMessages: Record<string, string> = {
      staff_approved: `"${reservation.guest_name}"님의 예약을 1차 승인하시겠습니까?`,
      approved: `"${reservation.guest_name}"님의 예약을 최종 승인하시겠습니까?`,
      rejected: `"${reservation.guest_name}"님의 예약을 거절하시겠습니까?`,
      in_use: `"${reservation.guest_name}"님의 대여를 시작하시겠습니까?`,
      returned: `"${reservation.guest_name}"님의 반납을 완료 처리하시겠습니까?`,
    };
    const msg = confirmMessages[nextStatus] || `상태를 "${statusLabel[nextStatus]}"(으)로 변경하시겠습니까?`;
    if (!confirm(msg)) return;

    try {
      const res = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reservation.id,
          status: nextStatus,
          admin_note: actionNote || reservation.admin_note,
          admin_id: adminId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "상태 변경에 실패했습니다");
      } else {
        toast.success(`${statusLabel[nextStatus]}(으)로 변경되었습니다`);
        setActionNote("");
        setSelectedReservation(null);
        fetchReservations();
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
    }
  }

  // 편집 모드 진입
  function startEdit(r: Reservation) {
    setEditForm({
      vehicle_id: r.vehicle_id,
      start_date: r.start_date,
      start_time: (r.start_time || "").slice(0, 5),
      end_date: r.end_date,
      end_time: (r.end_time || "").slice(0, 5),
    });
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
  }

  // 편집 저장
  async function saveEdit(r: Reservation) {
    // 유효성 검사
    if (
      !editForm.vehicle_id ||
      !editForm.start_date ||
      !editForm.start_time ||
      !editForm.end_date ||
      !editForm.end_time
    ) {
      toast.error("모든 항목을 입력해 주세요");
      return;
    }
    if (
      editForm.end_date < editForm.start_date ||
      (editForm.end_date === editForm.start_date &&
        editForm.end_time <= editForm.start_time)
    ) {
      toast.error("반납일시는 대여일시 이후여야 합니다");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: r.id,
          admin_id: adminId,
          vehicle_id: editForm.vehicle_id,
          start_date: editForm.start_date,
          start_time: editForm.start_time + ":00",
          end_date: editForm.end_date,
          end_time: editForm.end_time + ":00",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "수정에 실패했습니다");
      } else {
        toast.success("수정되었습니다");
        setEditMode(false);
        setSelectedReservation(null);
        fetchReservations();
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
    }
    setSavingEdit(false);
  }

  // 예약 삭제 (최고관리자만 - API 경유)
  async function handleDelete(id: string) {
    if (adminRole !== "super_admin") {
      toast.error("최고관리자만 삭제할 수 있습니다");
      return;
    }
    if (!confirm("이 예약을 완전히 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.")) return;

    try {
      const res = await fetch("/api/reservations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          admin_id: adminId,
          admin_name: "", // 서버에서 조회
          admin_role: adminRole,
        }),
      });

      if (res.ok) {
        toast.success("예약이 삭제되었습니다");
        setSelectedReservation(null);
        fetchReservations();
      } else {
        const data = await res.json();
        toast.error(data.error || "삭제에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류");
    }
  }

  // 상태 변경 버튼의 라벨과 색상
  function getActionButton(status: string) {
    switch (status) {
      case "staff_approved":
        return { label: "차량담당 장로 승인", color: "bg-emerald-500 hover:bg-emerald-600" };
      case "approved":
        return { label: "기획장로 승인", color: "bg-green-500 hover:bg-green-600" };
      case "rejected":
        return { label: "거절", color: "bg-red-500 hover:bg-red-600" };
      case "in_use":
        return { label: "대여 시작", color: "bg-blue-500 hover:bg-blue-600" };
      case "returned":
        return { label: "반납 완료", color: "bg-purple-500 hover:bg-purple-600" };
      default:
        return { label: status, color: "bg-gray-500" };
    }
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

      {/* ===== 상세보기 팝업 ===== */}
      {selectedReservation && (() => {
        const r = selectedReservation;
        const transitions = statusTransitions[r.status] || [];

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => { setSelectedReservation(null); setActionNote(""); setEditMode(false); }}
          >
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 팝업 헤더 */}
              <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{r.vehicles?.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.vehicles?.plate_number} · {r.start_date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <button
                    onClick={() => { setSelectedReservation(null); setActionNote(""); setEditMode(false); }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 팝업 컨텐츠 */}
              <div className="px-4 py-4 space-y-4">
                {/* 신청자 정보 */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">신청자 정보</h4>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                    <DetailRow label="신청자" value={`${r.guest_name} (${r.department})`} />
                    <DetailRow label="연락처" value={r.phone} />
                    {r.driver_name && <DetailRow label="운전자" value={r.driver_name} />}
                    {r.passenger_count && <DetailRow label="탑승인원" value={`${r.passenger_count}명`} />}
                  </div>
                </div>

                {/* 사용 일정 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-400">사용 일정 / 차량</h4>
                    {!editMode ? (
                      <button
                        onClick={() => startEdit(r)}
                        className="text-[11px] font-medium text-primary-600 hover:text-primary-700 px-2 py-0.5 rounded-md hover:bg-primary-50 transition-colors"
                      >
                        ✏ 수정
                      </button>
                    ) : (
                      <button
                        onClick={cancelEdit}
                        className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        취소
                      </button>
                    )}
                  </div>

                  {!editMode ? (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                      <DetailRow label="차량" value={`${r.vehicles?.name || "-"}${r.vehicles?.plate_number ? ` (${r.vehicles.plate_number})` : ""}`} />
                      <DetailRow label="대여" value={`${r.start_date} ${r.start_time?.slice(0, 5)}`} />
                      <DetailRow label="반납" value={`${r.end_date} ${r.end_time?.slice(0, 5)}`} />
                      {r.destination && <DetailRow label="행선지" value={r.destination} />}
                      {r.purpose && <DetailRow label="사용목적" value={r.purpose} />}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">차량 *</label>
                        <select
                          value={editForm.vehicle_id}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, vehicle_id: e.target.value }))
                          }
                          className="input-field !py-2 text-sm"
                        >
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                              {v.plate_number ? ` (${v.plate_number})` : ""}
                              {v.available ? "" : " · 사용불가"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">대여일 *</label>
                          <input
                            type="date"
                            value={editForm.start_date}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, start_date: e.target.value }))
                            }
                            className="input-field !py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">대여시간 *</label>
                          <input
                            type="time"
                            value={editForm.start_time}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, start_time: e.target.value }))
                            }
                            className="input-field !py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">반납일 *</label>
                          <input
                            type="date"
                            value={editForm.end_date}
                            min={editForm.start_date}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, end_date: e.target.value }))
                            }
                            className="input-field !py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">반납시간 *</label>
                          <input
                            type="time"
                            value={editForm.end_time}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, end_time: e.target.value }))
                            }
                            className="input-field !py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={cancelEdit}
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          취소
                        </button>

                        <button
                          onClick={() => saveEdit(r)}
                          disabled={savingEdit}
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300"
                        >
                          {savingEdit ? "저장 중..." : "저장"}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        ※ 차량 중복 예약 검사는 수행하지 않습니다. 일정 충돌 여부는 캘린더에서 확인해 주세요.
                      </p>
                    </div>
                  )}
                </div>

                {/* 승인 현황 */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">승인 현황</h4>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex gap-3">
                      <div className="flex-1 text-center">
                        <div className={`text-xs font-bold ${r.staff_approved_at ? "text-emerald-600" : "text-gray-300"}`}>
                          {r.staff_approved_at ? "✓ 승인" : "⏳ 대기"}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">1차 승인</div>
                        {r.staff_approved_at && (
                          <>
                            {getAdminName(r.staff_approved_by) && (
                              <div className="text-[10px] text-emerald-600 font-medium">
                                {getAdminName(r.staff_approved_by)}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-400">
                              {new Date(r.staff_approved_at).toLocaleDateString("ko-KR")}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="w-px bg-gray-200" />
                      <div className="flex-1 text-center">
                        <div className={`text-xs font-bold ${r.manager_approved_at ? "text-green-600" : "text-gray-300"}`}>
                          {r.manager_approved_at ? "✓ 승인" : "⏳ 대기"}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">2차 승인</div>
                        {r.manager_approved_at && (
                          <>
                            {getAdminName(r.manager_approved_by) && (
                              <div className="text-[10px] text-green-600 font-medium">
                                {getAdminName(r.manager_approved_by)}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-400">
                              {new Date(r.manager_approved_at).toLocaleDateString("ko-KR")}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 사진 */}
                {r.reservation_photos && r.reservation_photos.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">첨부 사진</h4>
                    <div className="space-y-2">
                      {r.reservation_photos.filter((p) => p.photo_type === "pickup").length > 0 && (
                        <PhotoUpload
                          reservationId={r.id}
                          photoType="pickup"
                          existingPhotos={r.reservation_photos.filter((p) => p.photo_type === "pickup")}
                          readOnly={true}
                        />
                      )}
                      {r.reservation_photos.filter((p) => p.photo_type === "return").length > 0 && (
                        <PhotoUpload
                          reservationId={r.id}
                          photoType="return"
                          existingPhotos={r.reservation_photos.filter((p) => p.photo_type === "return")}
                          readOnly={true}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* 관리자 메모 */}
                {r.admin_note && (
                  <div className="bg-yellow-50 rounded-xl p-3">
                    <p className="text-xs text-yellow-700">📝 {r.admin_note}</p>
                  </div>
                )}

                {/* 상태 변경 액션 */}
                {transitions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <textarea
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="관리자 메모 (선택)"
                      rows={2}
                      className="input-field text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      {transitions.map((next) => {
                        const btn = getActionButton(next);
                        const allowed = canTransition(next);
                        return (
                          <button
                            key={next}
                            onClick={() => handleStatusChange(r, next)}
                            disabled={!allowed}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-white text-xs font-medium
                              ${allowed ? btn.color : "bg-gray-300 cursor-not-allowed"}`}
                            title={!allowed ? "이 작업은 권한이 없습니다" : ""}
                          >
                            {btn.label}
                            {!allowed && " 🔒"}
                          </button>
                        );
                      })}
                    </div>
                    {!canTransition(transitions[0]) && (
                      <p className="text-[10px] text-gray-400 text-center">
                        {adminRole === "member"
                          ? "부원은 승인 권한이 없습니다 (조회만 가능)"
                          : adminRole === "staff" && transitions.includes("approved")
                          ? "기획장로 승인은 기획장로 권한이 필요합니다"
                          : "이 단계의 승인 권한이 없습니다"}
                      </p>
                    )}
                  </div>
                )}

                {/* 최고관리자 삭제 버튼 */}
                {adminRole === "super_admin" && (
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="w-full py-2 text-xs text-red-500 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      이 예약 삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right break-keep">{value}</span>
    </div>
  );
}

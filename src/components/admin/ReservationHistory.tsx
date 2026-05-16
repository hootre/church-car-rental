"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import ReservationDetailModal from "@/components/admin/ReservationDetailModal";
import {
  supabase, Reservation, Vehicle, Admin,
} from "@/lib/supabase";

interface Props {
  adminRole?: string;
  adminId?: string;
}

type SortKey = "newest" | "oldest" | "name" | "status";

export default function ReservationHistory({ adminRole, adminId }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  // 상세 팝업
  const [modalReservation, setModalReservation] = useState<Reservation | null>(null);

  // 필터
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  // 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 차량 + 관리자 목록
  useEffect(() => {
    async function fetchMeta() {
      const [vRes, aRes] = await Promise.all([
        supabase.from("vehicles").select("*").order("sort_order"),
        supabase.from("admins").select("*"),
      ]);
      setVehicles(vRes.data || []);
      setAdmins(aRes.data || []);
    }
    fetchMeta();
  }, []);

  const statusOrder: Record<string, number> = {
    pending: 0, staff_approved: 1, approved: 2, in_use: 3,
    returned: 4, cancelled: 5, rejected: 6,
  };

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("reservations")
      .select("*, vehicles(*), reservation_photos(*)")
      .order("created_at", { ascending: false });

    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterVehicle !== "all") query = query.eq("vehicle_id", filterVehicle);
    if (filterDateFrom) query = query.gte("start_date", filterDateFrom);
    if (filterDateTo) query = query.lte("start_date", filterDateTo);

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      toast.error("내역을 불러오지 못했습니다");
    } else {
      let filtered = data || [];
      if (searchName.trim()) {
        const keyword = searchName.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.guest_name.toLowerCase().includes(keyword) ||
            r.phone.includes(keyword) ||
            r.department.toLowerCase().includes(keyword)
        );
      }
      setReservations(filtered);
    }
    setSelectedIds(new Set());
  }, [filterStatus, filterVehicle, filterDateFrom, filterDateTo, searchName]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // 정렬 적용
  const sorted = [...reservations].sort((a, b) => {
    switch (sortKey) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "name":
        return a.guest_name.localeCompare(b.guest_name, "ko");
      case "status":
        return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      default:
        return 0;
    }
  });

  // 오늘 날짜 (한국시간 기준)
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  // 미래/진행중 vs 과거 분리
  // - 예정: 아직 끝나지 않은 예약 (end_date >= today)
  // - 지난 예약: 이미 끝난 예약 (end_date < today)
  const upcomingItems = sorted.filter((r) => r.end_date >= todayStr);
  const pastItems = sorted.filter((r) => r.end_date < todayStr);
  // 호환용 (기존 todayItems / restItems 사용처가 남아 있을 경우 대비)
  const todayItems = upcomingItems.filter(
    (r) => r.start_date <= todayStr && r.end_date >= todayStr
  );
  const todayIds = new Set(todayItems.map((r) => r.id));
  const restItems = upcomingItems.filter((r) => !todayIds.has(r.id));

  // 월별 그룹핑
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  function groupByMonth(
    items: Reservation[],
    order: "asc" | "desc" = "asc"
  ): { key: string; label: string; items: Reservation[] }[] {
    const groups: Record<string, Reservation[]> = {};
    for (const r of items) {
      const date = new Date(r.start_date || r.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => (order === "asc" ? a.localeCompare(b) : b.localeCompare(a)))
      .map(([key, items]) => {
        const [year, month] = key.split("-");
        // 월 안에서는 1일 → 30일 순 (start_date + start_time asc)
        const sortedItems = [...items].sort((a, b) => {
          const aKey = `${a.start_date} ${a.start_time || "00:00:00"}`;
          const bKey = `${b.start_date} ${b.start_time || "00:00:00"}`;
          return aKey.localeCompare(bKey);
        });
        return { key, label: `${year}년 ${parseInt(month)}월`, items: sortedItems };
      });
  }

  // 예정: 가까운 월 위 (asc) / 지난 예약: 최근 월 위 (desc)
  const upcomingMonthly = groupByMonth(upcomingItems, "asc");
  const pastMonthly = groupByMonth(pastItems, "desc");
  // 호환용
  const monthlyGroups = upcomingMonthly;

  function toggleMonth(monthKey: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

  // 선택 관련
  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((r) => r.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 일괄 삭제 (최고관리자만 - API 경유)
  async function handleBulkDelete() {
    if (adminRole !== "super_admin") {
      toast.error("최고관리자만 삭제할 수 있습니다");
      return;
    }
    const count = selectedIds.size;
    if (!confirm(`선택한 ${count}건의 예약을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) return;

    const ids = Array.from(selectedIds);
    let successCount = 0;
    for (const id of ids) {
      try {
        const res = await fetch("/api/reservations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, admin_id: adminId, admin_role: adminRole }),
        });
        if (res.ok) successCount++;
      } catch { /* continue */ }
    }

    if (successCount > 0) {
      toast.success(`${successCount}건 삭제되었습니다`);
      fetchReservations();
    } else {
      toast.error("삭제에 실패했습니다");
    }
  }

  // 필터 초기화
  function resetFilters() {
    setSearchName("");
    setFilterStatus("all");
    setFilterVehicle("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  // 활성 필터 수
  const activeFilterCount = [
    filterStatus !== "all",
    filterVehicle !== "all",
    !!filterDateFrom,
    !!filterDateTo,
  ].filter(Boolean).length;

  // 상태 필터 칩
  const statusChips: { key: string; label: string; color: string }[] = [
    { key: "all", label: "전체", color: "bg-gray-100 text-gray-700" },
    { key: "pending", label: "1차 대기", color: "bg-yellow-100 text-yellow-700" },
    { key: "staff_approved", label: "2차 대기", color: "bg-orange-100 text-orange-700" },
    { key: "approved", label: "승인완료", color: "bg-green-100 text-green-700" },
    { key: "in_use", label: "대여중", color: "bg-blue-100 text-blue-700" },
    { key: "returned", label: "반납완료", color: "bg-purple-100 text-purple-700" },
    { key: "cancelled", label: "취소", color: "bg-gray-200 text-gray-600" },
    { key: "rejected", label: "거절", color: "bg-red-100 text-red-700" },
  ];

  return (
    <div>
      {/* 검색 + 필터 토글 */}
      <div className="card mb-3 space-y-3 overflow-visible">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="이름, 전화번호, 부서 검색"
              className="input-field !py-2 !pl-9 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-primary-50 border-primary-300 text-primary-700"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* 상태 필터 칩 */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1 px-0.5">
          {statusChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilterStatus(chip.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                filterStatus === chip.key
                  ? chip.color + " ring-2 ring-offset-1 ring-primary-400"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* 상세 필터 */}
        {showFilters && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">차량</label>
                <select
                  value={filterVehicle}
                  onChange={(e) => setFilterVehicle(e.target.value)}
                  className="input-field !py-2 text-sm"
                >
                  <option value="all">전체</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">정렬</label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="input-field !py-2 text-sm"
                >
                  <option value="newest">최신순</option>
                  <option value="oldest">오래된순</option>
                  <option value="name">이름순</option>
                  <option value="status">상태순</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">시작일</label>
                <input type="date" value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="input-field !py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">종료일</label>
                <input type="date" value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="input-field !py-2 text-sm" />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="text-xs text-red-400 hover:text-red-600">
                필터 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* 액션 바: 전체선택 + 건수 + 일괄 삭제 */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          {adminRole === "super_admin" && sorted.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                allSelected ? "bg-primary-500 border-primary-500" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}
          <p className="text-sm text-gray-500">
            총 <span className="font-bold text-gray-900">{sorted.length}</span>건
            {someSelected && (
              <span className="text-primary-600 font-medium"> · {selectedIds.size}건 선택</span>
            )}
          </p>
        </div>

        {/* 일괄 삭제 */}
        {adminRole === "super_admin" && someSelected && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            선택 삭제 ({selectedIds.size})
          </button>
        )}
      </div>

      {/* 예약 목록 - 월별 아코디언 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📜</div>
          <p className="text-gray-500 text-sm">검색 결과가 없습니다</p>
        </div>
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
                  <div
                    key={r.id}
                    className={`transition-colors ${selectedIds.has(r.id) ? "bg-primary-50/40" : ""}`}
                  >
                    <div className="flex items-center">
                      {adminRole === "super_admin" && (
                        <button
                          onClick={() => toggleSelect(r.id)}
                          className="pl-3 pr-1 py-3 self-stretch flex items-center"
                        >
                          <div className={`rounded border-2 flex items-center justify-center transition-colors ${
                            selectedIds.has(r.id) ? "bg-primary-500 border-primary-500" : "border-gray-300"
                          }`} style={{ width: 18, height: 18 }}>
                            {selectedIds.has(r.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )}
                      <button
                        onClick={() => setModalReservation(r)}
                        className="flex-1 px-3 py-3 text-left hover:bg-gray-50 transition-colors min-w-0"
                      >
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
                          <svg className="w-4 h-4 text-gray-300 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 월별 아코디언 */}
          {[...upcomingMonthly, ...pastMonthly].map((group, idx) => {
            const isPast = idx >= upcomingMonthly.length;
            const isFirstPast = isPast && idx === upcomingMonthly.length;
            const isCollapsed = collapsedMonths.has(group.key);
            const groupSelectedCount = group.items.filter((r) => selectedIds.has(r.id)).length;

            return (
              <div key={(isPast ? "p-" : "u-") + group.key}>
                {isFirstPast && (
                  <div className="flex items-center gap-3 px-1 pt-3 pb-1">
                    <div className="h-px flex-1 bg-gray-300" />
                    <span className="text-xs font-medium text-gray-500">↓ 지난 예약</span>
                    <div className="h-px flex-1 bg-gray-300" />
                  </div>
                )}
              <div className={`rounded-2xl overflow-hidden border border-gray-200 bg-white ${isPast ? "opacity-60" : ""}`}>
                {/* 월별 헤더 */}
                <button
                  onClick={() => toggleMonth(group.key)}
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
                  <div className="flex items-center gap-2">
                    {groupSelectedCount > 0 && (
                      <span className="text-[10px] bg-primary-100 text-primary-600 font-medium px-1.5 py-0.5 rounded-full">
                        {groupSelectedCount}선택
                      </span>
                    )}
                  </div>
                </button>

                {/* 월별 목록 */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {group.items.map((r) => (
                      <div
                        key={r.id}
                        className={`transition-colors ${
                          selectedIds.has(r.id) ? "bg-primary-50/40" : ""
                        }`}
                      >
                        <div className="flex items-center">
                          {/* 체크박스 */}
                          {adminRole === "super_admin" && (
                            <button
                              onClick={() => toggleSelect(r.id)}
                              className="pl-3 pr-1 py-3 self-stretch flex items-center"
                            >
                              <div className={`rounded border-2 flex items-center justify-center transition-colors ${
                                selectedIds.has(r.id) ? "bg-primary-500 border-primary-500" : "border-gray-300"
                              }`} style={{ width: 18, height: 18 }}>
                                {selectedIds.has(r.id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          )}

                          {/* 내용 클릭 영역 */}
                          <button
                            onClick={() => setModalReservation(r)}
                            className="flex-1 px-3 py-3 text-left hover:bg-gray-50 transition-colors min-w-0"
                          >
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
                              <svg className="w-4 h-4 text-gray-300 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 공통 상세 모달 */}
      {modalReservation && (
        <ReservationDetailModal
          reservation={modalReservation}
          adminId={adminId || ""}
          adminRole={adminRole || ""}
          vehicles={vehicles}
          admins={admins}
          onClose={() => setModalReservation(null)}
          onUpdated={() => fetchReservations()}
        />
      )}
    </div>
  );
}

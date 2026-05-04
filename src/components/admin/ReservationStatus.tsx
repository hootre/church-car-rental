"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import PhotoUpload from "@/components/PhotoUpload";
import {
  supabase, Reservation, Admin, statusLabel, statusColor,
  statusTransitions, statusRequiredRole,
} from "@/lib/supabase";

interface Props {
  adminId: string;
  adminRole: string;
}

export default function ReservationStatus({ adminId, adminRole }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [actionNote, setActionNote] = useState("");

  // 관리자 목록 조회
  useEffect(() => {
    supabase.from("admins").select("*").then(({ data }) => {
      setAdmins(data || []);
    });
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
    } else {
      const filtered = (data || []).filter((r) => r.status !== "cancelled");
      const sorted = filtered.sort((a, b) => {
        const diff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setReservations(sorted);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

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

    const updateData: Record<string, unknown> = {
      status: nextStatus,
      admin_note: actionNote || reservation.admin_note,
    };

    if (nextStatus === "staff_approved") {
      updateData.staff_approved_by = adminId;
      updateData.staff_approved_at = new Date().toISOString();
    }
    if (nextStatus === "approved") {
      updateData.manager_approved_by = adminId;
      updateData.manager_approved_at = new Date().toISOString();
    }
    if (nextStatus === "in_use") {
      updateData.picked_up_at = new Date().toISOString();
    }
    if (nextStatus === "returned") {
      updateData.returned_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", reservation.id);

    if (error) {
      toast.error("상태 변경에 실패했습니다");
    } else {
      toast.success(`${statusLabel[nextStatus]}(으)로 변경되었습니다`);
      setActionNote("");
      setSelectedReservation(null);
      fetchReservations();
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
        <StatCard label="담당장로" count={stats.pending} bg="bg-yellow-50" color="text-yellow-700" subColor="text-yellow-600" active={filter === "pending"} onClick={() => setFilter(filter === "pending" ? "all" : "pending")} />
        <StatCard label="기획장로" count={stats.staff_approved} bg="bg-emerald-50" color="text-emerald-700" subColor="text-emerald-600" active={filter === "staff_approved"} onClick={() => setFilter(filter === "staff_approved" ? "all" : "staff_approved")} />
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
        <div className="space-y-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReservation(r)}
              className="card w-full text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-bold text-sm text-gray-900">
                  {r.vehicles?.name}
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    {r.vehicles?.plate_number}
                  </span>
                </h4>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{r.guest_name} ({r.department})</span>
                <span>{r.start_date}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ===== 상세보기 팝업 ===== */}
      {selectedReservation && (() => {
        const r = selectedReservation;
        const transitions = statusTransitions[r.status] || [];

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => { setSelectedReservation(null); setActionNote(""); }}
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
                    onClick={() => { setSelectedReservation(null); setActionNote(""); }}
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
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">사용 일정</h4>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                    <DetailRow label="대여" value={`${r.start_date} ${r.start_time?.slice(0, 5)}`} />
                    <DetailRow label="반납" value={`${r.end_date} ${r.end_time?.slice(0, 5)}`} />
                    {r.destination && <DetailRow label="행선지" value={r.destination} />}
                    {r.purpose && <DetailRow label="사용목적" value={r.purpose} />}
                  </div>
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
                        <div className="text-[10px] text-gray-400 mt-0.5">차량담당 장로</div>
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
                        <div className="text-[10px] text-gray-400 mt-0.5">기획장로</div>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right break-keep">{value}</span>
    </div>
  );
}

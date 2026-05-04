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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      const sorted = (data || []).sort((a, b) => {
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

    // 차량담당 장로 승인
    if (nextStatus === "staff_approved") {
      updateData.staff_approved_by = adminId;
      updateData.staff_approved_at = new Date().toISOString();
    }
    // 기획장로 승인
    if (nextStatus === "approved") {
      updateData.manager_approved_by = adminId;
      updateData.manager_approved_at = new Date().toISOString();
    }
    // 대여 시작
    if (nextStatus === "in_use") {
      updateData.picked_up_at = new Date().toISOString();
    }
    // 반납
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
      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="담당장로" count={stats.pending} color="text-yellow-600" />
        <StatCard label="기획장로" count={stats.staff_approved} color="text-emerald-600" />
        <StatCard label="승인완료" count={stats.approved} color="text-green-600" />
        <StatCard label="대여중" count={stats.in_use} color="text-blue-600" />
        <StatCard label="반납완료" count={stats.returned} color="text-purple-600" />
        <StatCard label="전체" count={stats.total} color="text-gray-600" />
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {[
          { key: "all", label: "전체" },
          { key: "pending", label: "담당장로" },
          { key: "staff_approved", label: "기획장로" },
          { key: "approved", label: "승인완료" },
          { key: "in_use", label: "대여중" },
          { key: "returned", label: "반납완료" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 예약 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">예약이 없습니다</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            const transitions = statusTransitions[r.status] || [];

            return (
              <div key={r.id} className="card">
                {/* 요약 헤더 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="w-full text-left"
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

                {/* 상세 내용 */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="space-y-1.5 text-xs text-gray-500 mb-3">
                      <DetailRow label="신청자" value={`${r.guest_name} (${r.department})`} />
                      <DetailRow label="연락처" value={r.phone} />
                      <DetailRow label="사용일시" value={`${r.start_date} ${r.start_time?.slice(0, 5)} ~ ${r.end_date} ${r.end_time?.slice(0, 5)}`} />
                      {r.purpose && <DetailRow label="사용목적" value={r.purpose} />}
                      {r.destination && <DetailRow label="행선지" value={r.destination} />}
                      {r.passenger_count && <DetailRow label="탑승인원" value={`${r.passenger_count}명`} />}
                      {r.driver_name && <DetailRow label="운전자" value={r.driver_name} />}
                    </div>

                    {/* 승인 현황 */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">승인 현황</p>
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

                    {/* 사진 (읽기 전용) */}
                    {r.reservation_photos && r.reservation_photos.length > 0 && (
                      <div className="mb-3 space-y-2">
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
                    )}

                    {/* 관리자 메모 */}
                    {r.admin_note && (
                      <div className="bg-yellow-50 rounded-lg p-2 mb-3">
                        <p className="text-xs text-yellow-700">📝 {r.admin_note}</p>
                      </div>
                    )}

                    {/* 상태 변경 액션 */}
                    {transitions.length > 0 && (
                      <div className="space-y-2">
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
                                className={`flex-1 py-2 px-3 rounded-lg text-white text-xs font-medium
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{count}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

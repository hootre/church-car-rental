"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import PhotoUpload from "@/components/PhotoUpload";
import { supabase, Reservation, ReservationPhoto } from "@/lib/supabase";

export default function CheckPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    if (!phone.trim() || !name.trim()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*, vehicles(*), reservation_photos(*)")
      .eq("guest_name", name.trim())
      .eq("phone", phone.trim())
      .order("created_at", { ascending: false });

    setLoading(false);
    setSearched(true);

    if (error) {
      toast.error("조회에 실패했습니다");
      console.error(error);
    } else {
      setReservations(data || []);
    }
  }, [phone, name]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !name.trim()) {
      toast.error("이름과 전화번호를 입력해 주세요");
      return;
    }
    fetchReservations();
  }

  // 대여 시작 (approved → in_use)
  async function handlePickup(reservation: Reservation) {
    const photos = (reservation.reservation_photos || []).filter(
      (p) => p.photo_type === "pickup"
    );
    if (photos.length === 0) {
      toast.error("대여 시 차량 사진을 최소 1장 이상 등록해 주세요");
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "in_use",
        picked_up_at: new Date().toISOString(),
      })
      .eq("id", reservation.id);

    if (error) {
      toast.error("상태 변경에 실패했습니다");
    } else {
      toast.success("대여가 시작되었습니다. 안전운행 하세요!");
      fetchReservations();
    }
  }

  // 반납 완료 (in_use → returned)
  async function handleReturn(reservation: Reservation) {
    const photos = (reservation.reservation_photos || []).filter(
      (p) => p.photo_type === "return"
    );
    if (photos.length === 0) {
      toast.error("반납 시 차량 사진을 최소 1장 이상 등록해 주세요");
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "returned",
        returned_at: new Date().toISOString(),
      })
      .eq("id", reservation.id);

    if (error) {
      toast.error("상태 변경에 실패했습니다");
    } else {
      toast.success("반납이 완료되었습니다. 감사합니다!");
      fetchReservations();
    }
  }

  // 예약 취소 (pending, staff_approved만 가능)
  async function handleCancel(reservation: Reservation) {
    if (!confirm("예약을 취소하시겠습니까?")) return;

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        admin_note: `[대여자 본인 취소] ${reservation.admin_note || ""}`.trim(),
      })
      .eq("id", reservation.id);

    if (error) {
      toast.error("예약 취소에 실패했습니다");
    } else {
      toast.success("예약이 취소되었습니다");
      fetchReservations();
    }
  }

  // 상태별 안내 메시지
  function getStatusGuide(status: string) {
    switch (status) {
      case "pending":
        return "차량담당 장로 승인을 기다리고 있습니다";
      case "staff_approved":
        return "차량담당 장로가 승인했습니다. 기획장로 최종 승인을 기다리고 있습니다";
      case "approved":
        return "최종 승인되었습니다. 대여 시 차량 사진을 촬영하고 '대여 시작'을 눌러주세요";
      case "in_use":
        return "차량 사용 중입니다. 반납 시 차량 사진을 촬영하고 '반납 완료'를 눌러주세요";
      case "returned":
        return "반납이 완료되었습니다. 이용해 주셔서 감사합니다";
      case "rejected":
        return "예약이 거절되었습니다";
      case "cancelled":
        return "예약이 취소되었습니다";
      default:
        return "";
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <Header />

      <main className="max-w-lg mx-auto px-4 pt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">예약 조회</h2>
        <p className="text-sm text-gray-500 mb-6">
          예약 시 입력한 이름과 전화번호로 조회합니다
        </p>

        {/* 검색 폼 */}
        <form onSubmit={handleSearch} className="card space-y-3 mb-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="input-field"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호 (예: 010-0000-0000)"
            className="input-field"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "조회 중..." : "조회하기"}
          </button>
        </form>

        {/* 결과 */}
        {searched && reservations.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 text-sm">예약 내역이 없습니다</p>
            <p className="text-gray-400 text-xs mt-1">
              이름과 전화번호를 다시 확인해 주세요
            </p>
          </div>
        )}

        {reservations.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              총 <span className="font-bold text-gray-900">{reservations.length}</span>건
            </p>

            {reservations.map((r) => {
              const isExpanded = expandedId === r.id;
              const pickupPhotos = (r.reservation_photos || []).filter(
                (p) => p.photo_type === "pickup"
              );
              const returnPhotos = (r.reservation_photos || []).filter(
                (p) => p.photo_type === "return"
              );

              return (
                <div key={r.id} className="card">
                  {/* 헤더 */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900">
                        {r.vehicles?.name || "차량"}
                      </h3>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* 상태 안내 */}
                    <p className="text-xs text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg mb-2">
                      {getStatusGuide(r.status)}
                    </p>

                    {/* 기본 정보 */}
                    <div className="space-y-1 text-sm">
                      <InfoRow label="대여" value={`${r.start_date} ${r.start_time?.slice(0, 5)}`} />
                      <InfoRow label="반납" value={`${r.end_date} ${r.end_time?.slice(0, 5)}`} />
                      <InfoRow label="소속" value={r.department} />
                      {r.destination && <InfoRow label="행선지" value={r.destination} />}
                      {r.passenger_count && <InfoRow label="탑승인원" value={`${r.passenger_count}명`} />}
                      {r.driver_name && <InfoRow label="운전자" value={r.driver_name} />}
                      {r.purpose && <InfoRow label="사유" value={r.purpose} />}
                    </div>
                  </button>

                  {/* 확장 영역 */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
                      {/* 승인 현황 */}
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">승인 현황</p>
                        <div className="flex gap-3">
                          <div className="flex-1 text-center">
                            <div className={`text-xs font-bold ${r.staff_approved_at ? "text-emerald-600" : "text-gray-300"}`}>
                              {r.staff_approved_at ? "✓ 승인" : "⏳ 대기"}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">차량담당 장로</div>
                            {r.staff_approved_at && (
                              <div className="text-[10px] text-gray-400">
                                {new Date(r.staff_approved_at).toLocaleDateString("ko-KR")}
                              </div>
                            )}
                          </div>
                          <div className="w-px bg-gray-200" />
                          <div className="flex-1 text-center">
                            <div className={`text-xs font-bold ${r.manager_approved_at ? "text-green-600" : "text-gray-300"}`}>
                              {r.manager_approved_at ? "✓ 승인" : "⏳ 대기"}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">기획장로</div>
                            {r.manager_approved_at && (
                              <div className="text-[10px] text-gray-400">
                                {new Date(r.manager_approved_at).toLocaleDateString("ko-KR")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 추가 정보 */}
                      <div className="space-y-1 text-sm">
                        {r.admin_note && (
                          <div className="p-2 bg-yellow-50 rounded-lg">
                            <span className="text-xs text-yellow-700">📝 {r.admin_note}</span>
                          </div>
                        )}
                        {r.picked_up_at && (
                          <InfoRow
                            label="대여 시각"
                            value={new Date(r.picked_up_at).toLocaleString("ko-KR")}
                          />
                        )}
                        {r.returned_at && (
                          <InfoRow
                            label="반납 시각"
                            value={new Date(r.returned_at).toLocaleString("ko-KR")}
                          />
                        )}
                        <InfoRow
                          label="신청일"
                          value={new Date(r.created_at).toLocaleDateString("ko-KR")}
                        />
                      </div>

                      {/* ===== 대기/1차승인: 예약 취소 ===== */}
                      {(r.status === "pending" || r.status === "staff_approved") && (
                        <button
                          onClick={() => handleCancel(r)}
                          className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl
                                     hover:bg-orange-600 active:bg-orange-700 transition-colors"
                        >
                          예약취소
                        </button>
                      )}

                      {/* ===== 승인됨: 대여 사진 업로드 + 대여 시작 ===== */}
                      {r.status === "approved" && (
                        <div className="space-y-3">
                          <PhotoUpload
                            reservationId={r.id}
                            photoType="pickup"
                            existingPhotos={pickupPhotos}
                            onUploadComplete={fetchReservations}
                          />
                          <button
                            onClick={() => handlePickup(r)}
                            className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl
                                       hover:bg-blue-600 active:bg-blue-700 transition-colors"
                          >
                            🚗 대여 시작
                          </button>
                        </div>
                      )}

                      {/* ===== 대여중: 반납 사진 업로드 + 반납 완료 ===== */}
                      {r.status === "in_use" && (
                        <div className="space-y-3">
                          {/* 대여 시 사진 보기 */}
                          {pickupPhotos.length > 0 && (
                            <div className="opacity-70">
                              <PhotoUpload
                                reservationId={r.id}
                                photoType="pickup"
                                existingPhotos={pickupPhotos}
                                readOnly
                              />
                            </div>
                          )}

                          {/* 반납 사진 업로드 */}
                          <PhotoUpload
                            reservationId={r.id}
                            photoType="return"
                            existingPhotos={returnPhotos}
                            onUploadComplete={fetchReservations}
                          />
                          <button
                            onClick={() => handleReturn(r)}
                            className="w-full py-3 bg-purple-500 text-white font-semibold rounded-xl
                                       hover:bg-purple-600 active:bg-purple-700 transition-colors"
                          >
                            🔑 반납 완료
                          </button>
                        </div>
                      )}

                      {/* ===== 반납완료: 사진 보기 전용 ===== */}
                      {r.status === "returned" && (
                        <div className="space-y-3">
                          {pickupPhotos.length > 0 && (
                            <PhotoUpload
                              reservationId={r.id}
                              photoType="pickup"
                              existingPhotos={pickupPhotos}
                              readOnly
                            />
                          )}
                          {returnPhotos.length > 0 && (
                            <PhotoUpload
                              reservationId={r.id}
                              photoType="return"
                              existingPhotos={returnPhotos}
                              readOnly
                            />
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
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

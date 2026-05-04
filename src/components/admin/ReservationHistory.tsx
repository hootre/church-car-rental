"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import PhotoUpload from "@/components/PhotoUpload";
import {
  supabase, Reservation, Vehicle, Admin,
  vehicleTypeLabel, statusLabel, categoryLabel,
} from "@/lib/supabase";

export default function ReservationHistory() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  // 상세 팝업
  const [modalReservation, setModalReservation] = useState<Reservation | null>(null);

  // 필터 상태
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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

  // 관리자 이름 찾기
  function getAdminName(adminId: string | null): string {
    if (!adminId) return "-";
    const admin = admins.find((a) => a.id === adminId);
    return admin ? admin.name : "-";
  }

  // 예약 내역 조회
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
      filtered.sort((a, b) => {
        const diff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setReservations(filtered);
    }
  }, [filterStatus, filterVehicle, filterDateFrom, filterDateTo, searchName]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // 예약 삭제
  async function handleDelete(id: string) {
    if (!confirm("이 예약을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      toast.success("삭제되었습니다");
      if (modalReservation?.id === id) setModalReservation(null);
      fetchReservations();
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

  // ===== 문서 출력 =====
  function handlePrint(r: Reservation) {
    const staffName = getAdminName(r.staff_approved_by);
    const managerName = getAdminName(r.manager_approved_by);
    const vehicleName = r.vehicles?.name || "-";
    const plateNumber = r.vehicles?.plate_number || "-";
    const vehicleType = vehicleTypeLabel[r.vehicles?.type || ""] || r.vehicles?.type || "-";

    const pickupPhotos = (r.reservation_photos || []).filter((p) => p.photo_type === "pickup");
    const returnPhotos = (r.reservation_photos || []).filter((p) => p.photo_type === "return");
    const hasPhotos = pickupPhotos.length > 0 || returnPhotos.length > 0;

    function buildPhotoHtml(photos: typeof pickupPhotos, label: string) {
      if (photos.length === 0) return "";
      const imgs = photos.map((p) =>
        `<img src="${p.photo_url}" style="width:70px;height:70px;object-fit:cover;border:1px solid #ccc;border-radius:4px;" />`
      ).join("");
      return `<div style="flex:1;min-width:0;"><span style="font-size:10px;font-weight:600;color:#555;">${label}</span><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">${imgs}</div></div>`;
    }

    const printHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>차량 예약 확인서 - ${r.guest_name}</title>
<style>
  @page { size: A4; margin: 15mm 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #222; line-height: 1.35; font-size: 11px; }
  .page { width: 100%; max-height: 257mm; overflow: hidden; display: flex; flex-direction: column; }
  .header { text-align: center; border-bottom: 2px double #333; padding-bottom: 8px; margin-bottom: 10px; }
  .header h1 { font-size: 18px; font-weight: 700; letter-spacing: 6px; }
  .header-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
  .header .org { font-size: 11px; color: #666; }
  .print-date { font-size: 10px; color: #999; }
  .content { flex: 1; }
  .row2 { display: flex; gap: 8px; margin-bottom: 6px; }
  .row2 > div { flex: 1; }
  .section { margin-bottom: 6px; }
  .section-title { font-size: 10px; font-weight: 700; color: #333; background: #f0f0f0; padding: 3px 8px; margin-bottom: 4px; border-left: 2px solid #333; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 3px 7px; text-align: left; }
  th { background: #fafafa; font-weight: 600; width: 70px; color: #555; white-space: nowrap; }
  td { color: #222; }
  .approval-box { display: flex; gap: 8px; margin-bottom: 6px; }
  .approval-card { flex: 1; border: 1px solid #ccc; text-align: center; padding: 8px 4px; }
  .approval-card .title { font-size: 10px; color: #666; font-weight: 600; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
  .approval-card .stamp { font-size: 16px; font-weight: 700; color: #1a7f37; }
  .approval-card .name { font-size: 10px; color: #444; margin-top: 2px; }
  .approval-card .date { font-size: 9px; color: #999; }
  .approval-card .pending { font-size: 11px; color: #bbb; padding: 6px 0; }
  .status-badge { display: inline-block; padding: 1px 8px; border-radius: 8px; font-size: 10px; font-weight: 600; }
  .status-approved { background: #dcfce7; color: #166534; }
  .status-pending { background: #fef9c3; color: #854d0e; }
  .status-rejected { background: #fecaca; color: #991b1b; }
  .status-in_use { background: #dbeafe; color: #1e40af; }
  .status-returned { background: #ede9fe; color: #5b21b6; }
  .status-staff_approved { background: #d1fae5; color: #065f46; }
  .memo-box { border: 1px solid #ccc; padding: 4px 7px; font-size: 11px; color: #333; min-height: 20px; }
  .footer { text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #ddd; padding-top: 6px; margin-top: auto; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .page { height: 257mm; }
  }
  @media screen {
    .page { max-width: 210mm; margin: 0 auto; padding: 15mm 18mm; border: 1px solid #ddd; background: #fff; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>차량 예약 확인서</h1>
    <div class="header-meta">
      <span class="org">한국중앙교회 차량관리</span>
      <span class="print-date">출력일: ${new Date().toLocaleDateString("ko-KR")} ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  </div>

  <div class="content">
    <div style="margin-bottom:8px;">
      <span class="status-badge status-${r.status}">${statusLabel[r.status] || r.status}</span>
      <span style="font-size:10px;color:#999;margin-left:6px;">신청일: ${new Date(r.created_at).toLocaleString("ko-KR")}</span>
    </div>

    <div class="row2">
      <div class="section">
        <div class="section-title">신청자 정보</div>
        <table>
          <tr><th>이름</th><td>${r.guest_name}</td></tr>
          <tr><th>부서</th><td>${r.department}</td></tr>
          <tr><th>연락처</th><td>${r.phone}</td></tr>
          ${r.driver_name ? `<tr><th>운전자</th><td>${r.driver_name}</td></tr>` : ""}
        </table>
      </div>
      <div class="section">
        <div class="section-title">차량 정보</div>
        <table>
          <tr><th>차량명</th><td>${vehicleName}</td></tr>
          <tr><th>차량번호</th><td>${plateNumber}</td></tr>
          <tr><th>차종</th><td>${vehicleType}</td></tr>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-title">사용 일정</div>
      <table>
        <tr>
          <th>대여</th><td>${r.start_date} ${r.start_time?.slice(0, 5) || ""}</td>
          <th>반납</th><td>${r.end_date} ${r.end_time?.slice(0, 5) || ""}</td>
        </tr>
        <tr>
          <th>행선지</th><td>${r.destination || "-"}</td>
          <th>탑승인원</th><td>${r.passenger_count ? r.passenger_count + "명" : "-"}</td>
        </tr>
        ${r.purpose ? `<tr><th>사용목적</th><td colspan="3">${r.purpose}</td></tr>` : ""}
        ${r.picked_up_at || r.returned_at ? `
        <tr>
          <th>실제대여</th><td>${r.picked_up_at ? new Date(r.picked_up_at).toLocaleString("ko-KR") : "-"}</td>
          <th>실제반납</th><td>${r.returned_at ? new Date(r.returned_at).toLocaleString("ko-KR") : "-"}</td>
        </tr>` : ""}
      </table>
    </div>

    ${r.admin_note ? `
    <div class="section">
      <div class="section-title">관리자 메모</div>
      <div class="memo-box">${r.admin_note}</div>
    </div>
    ` : ""}

    <div class="section">
      <div class="section-title">승인 현황</div>
      <div class="approval-box">
        <div class="approval-card">
          <div class="title">차량담당 장로 승인</div>
          ${r.staff_approved_at
            ? `<div class="stamp">승인</div><div class="name">${staffName}</div><div class="date">${new Date(r.staff_approved_at).toLocaleDateString("ko-KR")}</div>`
            : `<div class="pending">미승인</div>`
          }
        </div>
        <div class="approval-card">
          <div class="title">기획장로 승인</div>
          ${r.manager_approved_at
            ? `<div class="stamp">승인</div><div class="name">${managerName}</div><div class="date">${new Date(r.manager_approved_at).toLocaleDateString("ko-KR")}</div>`
            : `<div class="pending">미승인</div>`
          }
        </div>
      </div>
    </div>

    ${hasPhotos ? `
    <div class="section">
      <div class="section-title">차량 사진</div>
      <div style="display:flex;gap:12px;padding:4px 0;">
        ${buildPhotoHtml(pickupPhotos, "대여 시")}
        ${buildPhotoHtml(returnPhotos, "반납 시")}
      </div>
    </div>
    ` : ""}

    <div style="margin-top:8px;">
      <table>
        <tr>
          <th style="width:70px;">신청인</th>
          <td style="height:32px;"></td>
          <th style="width:70px;">확인자</th>
          <td style="height:32px;"></td>
        </tr>
      </table>
    </div>
  </div>

  <div class="footer">
    본 문서는 한국중앙교회 차량관리 시스템에서 자동 생성되었습니다.
  </div>
</div>

<div class="no-print" style="text-align:center;margin-top:16px;">
  <button onclick="window.print()" style="padding:8px 28px;background:#4f46e5;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;">
    인쇄하기
  </button>
  <button onclick="window.close()" style="padding:8px 28px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;margin-left:8px;">
    닫기
  </button>
</div>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    }
  }

  return (
    <div>
      {/* 검색 및 필터 */}
      <div className="card mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="이름, 전화번호, 부서 검색"
            className="input-field !py-2 text-sm flex-1"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              showFilters
                ? "bg-primary-50 border-primary-300 text-primary-700"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            필터
          </button>
        </div>

        {showFilters && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">상태</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="input-field !py-2 text-sm"
                >
                  <option value="all">전체</option>
                  <option value="pending">담당장로</option>
                  <option value="staff_approved">기획장로</option>
                  <option value="approved">승인완료</option>
                  <option value="in_use">대여중</option>
                  <option value="returned">반납완료</option>
                  <option value="cancelled">예약취소</option>
                  <option value="rejected">거절</option>
                </select>
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">시작일</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="input-field !py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">종료일</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="input-field !py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={resetFilters}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

      {/* 결과 수 */}
      <p className="text-sm text-gray-500 mb-3">
        총 <span className="font-bold text-gray-900">{reservations.length}</span>건
      </p>

      {/* 예약 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📜</div>
          <p className="text-gray-500 text-sm">검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => (
            <button
              key={r.id}
              onClick={() => setModalReservation(r)}
              className="card !p-0 overflow-hidden w-full text-left hover:bg-gray-50 transition-colors"
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
          ))}
        </div>
      )}

      {/* ===== 상세보기 팝업 (모달) ===== */}
      {modalReservation && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setModalReservation(null)}
        >
          {/* 배경 오버레이 */}
          <div className="absolute inset-0 bg-black/50" />

          {/* 모달 본체 */}
          <div
            className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-bold text-lg text-gray-900">예약 상세</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalReservation.vehicles?.name} · {modalReservation.start_date}
                </p>
              </div>
              <button
                onClick={() => setModalReservation(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 컨텐츠 */}
            <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-4">
              {/* 상태 */}
              <div className="flex items-center gap-2">
                <StatusBadge status={modalReservation.status} />
                <span className="text-sm text-gray-500">
                  {new Date(modalReservation.created_at).toLocaleString("ko-KR")} 신청
                </span>
              </div>

              {/* 신청자 정보 */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">신청자 정보</h4>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <ModalRow label="이름" value={modalReservation.guest_name} />
                  <ModalRow label="부서" value={modalReservation.department} />
                  <ModalRow label="연락처" value={modalReservation.phone} />
                  {modalReservation.driver_name && (
                    <ModalRow label="운전자" value={modalReservation.driver_name} />
                  )}
                </div>
              </div>

              {/* 차량 정보 */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">차량 정보</h4>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <ModalRow label="차량명" value={modalReservation.vehicles?.name || "-"} />
                  <ModalRow label="차량번호" value={modalReservation.vehicles?.plate_number || "-"} />
                  <ModalRow
                    label="차종"
                    value={vehicleTypeLabel[modalReservation.vehicles?.type || ""] || modalReservation.vehicles?.type || "-"}
                  />
                  {modalReservation.vehicles?.category && (
                    <ModalRow label="분류" value={categoryLabel[modalReservation.vehicles.category] || "공유차량"} />
                  )}
                </div>
              </div>

              {/* 사용 일정 */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">사용 일정</h4>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <ModalRow label="대여일시" value={`${modalReservation.start_date} ${modalReservation.start_time?.slice(0, 5)}`} />
                  <ModalRow label="반납일시" value={`${modalReservation.end_date} ${modalReservation.end_time?.slice(0, 5)}`} />
                  {modalReservation.destination && (
                    <ModalRow label="행선지" value={modalReservation.destination} />
                  )}
                  {modalReservation.passenger_count && (
                    <ModalRow label="탑승인원" value={`${modalReservation.passenger_count}명`} />
                  )}
                  {modalReservation.purpose && (
                    <ModalRow label="사용목적" value={modalReservation.purpose} />
                  )}
                  {modalReservation.picked_up_at && (
                    <ModalRow label="실제 대여" value={new Date(modalReservation.picked_up_at).toLocaleString("ko-KR")} />
                  )}
                  {modalReservation.returned_at && (
                    <ModalRow label="실제 반납" value={new Date(modalReservation.returned_at).toLocaleString("ko-KR")} />
                  )}
                </div>
              </div>

              {/* 관리자 메모 */}
              {modalReservation.admin_note && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">관리자 메모</h4>
                  <div className="bg-yellow-50 rounded-xl p-3">
                    <p className="text-sm text-yellow-800">{modalReservation.admin_note}</p>
                  </div>
                </div>
              )}

              {/* 승인 현황 */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">승인 현황</h4>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex gap-4">
                    {/* 차량담당 장로 승인 */}
                    <div className="flex-1 text-center">
                      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                        modalReservation.staff_approved_at
                          ? "bg-emerald-100"
                          : "bg-gray-200"
                      }`}>
                        {modalReservation.staff_approved_at ? (
                          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className={`text-sm font-bold ${
                        modalReservation.staff_approved_at ? "text-emerald-700" : "text-gray-400"
                      }`}>
                        {modalReservation.staff_approved_at ? "승인완료" : "미승인"}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">차량담당 장로</div>
                      {modalReservation.staff_approved_at && (
                        <>
                          <div className="text-xs text-gray-600 mt-1 font-medium">
                            {getAdminName(modalReservation.staff_approved_by)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(modalReservation.staff_approved_at).toLocaleDateString("ko-KR")}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 화살표 */}
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    {/* 기획장로 승인 */}
                    <div className="flex-1 text-center">
                      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                        modalReservation.manager_approved_at
                          ? "bg-green-100"
                          : "bg-gray-200"
                      }`}>
                        {modalReservation.manager_approved_at ? (
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className={`text-sm font-bold ${
                        modalReservation.manager_approved_at ? "text-green-700" : "text-gray-400"
                      }`}>
                        {modalReservation.manager_approved_at ? "승인완료" : "미승인"}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">기획장로</div>
                      {modalReservation.manager_approved_at && (
                        <>
                          <div className="text-xs text-gray-600 mt-1 font-medium">
                            {getAdminName(modalReservation.manager_approved_by)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(modalReservation.manager_approved_at).toLocaleDateString("ko-KR")}.
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 사진 */}
              {modalReservation.reservation_photos && modalReservation.reservation_photos.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">첨부 사진</h4>
                  <div className="space-y-2">
                    {modalReservation.reservation_photos.filter((p) => p.photo_type === "pickup").length > 0 && (
                      <PhotoUpload
                        reservationId={modalReservation.id}
                        photoType="pickup"
                        existingPhotos={modalReservation.reservation_photos.filter((p) => p.photo_type === "pickup")}
                        readOnly
                      />
                    )}
                    {modalReservation.reservation_photos.filter((p) => p.photo_type === "return").length > 0 && (
                      <PhotoUpload
                        reservationId={modalReservation.id}
                        photoType="return"
                        existingPhotos={modalReservation.reservation_photos.filter((p) => p.photo_type === "return")}
                        readOnly
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 px-4 py-3 sm:px-5 flex gap-2 safe-area-bottom">
              <button
                onClick={() => handlePrint(modalReservation)}
                className="flex-1 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                문서 출력
              </button>
              <button
                onClick={() => setModalReservation(null)}
                className="py-2.5 px-6 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right break-keep">{value}</span>
    </div>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right break-keep">{value}</span>
    </div>
  );
}

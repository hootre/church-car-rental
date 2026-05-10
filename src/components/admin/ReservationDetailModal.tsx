"use client";

/**
 * 예약 상세 모달 (예약현황 / 예약내역 공용)
 *
 * - 보기 모드: 신청자/차량/일정/승인현황/사진 한눈에
 * - 편집 모드: 차량, 대여일시, 반납일시, 상태, 관리자 메모를 한 폼에서 편집/저장
 * - 푸터: 수정 / 문서출력 / 삭제(super_admin) / 닫기
 */

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import PhotoUpload from "@/components/PhotoUpload";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Reservation,
  Vehicle,
  Admin,
  vehicleTypeLabel,
  statusLabel,
  categoryLabel,
  statusRequiredRole,
} from "@/lib/supabase";

const ALL_STATUSES: { value: string; label: string }[] = [
  { value: "pending", label: "대기중" },
  { value: "staff_approved", label: "차량담당 장로 승인" },
  { value: "approved", label: "승인완료" },
  { value: "in_use", label: "대여중" },
  { value: "returned", label: "반납완료" },
  { value: "rejected", label: "거절" },
  { value: "cancelled", label: "예약취소" },
];

interface Props {
  reservation: Reservation;
  adminId: string;
  adminRole: string;
  vehicles: Vehicle[];
  admins: Admin[];
  onClose: () => void;
  onUpdated: () => void; // 변경/삭제 후 부모가 목록을 다시 불러오도록
}

export default function ReservationDetailModal({
  reservation: r,
  adminId,
  adminRole,
  vehicles,
  admins,
  onClose,
  onUpdated,
}: Props) {
  const confirm = useConfirm();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    vehicle_id: r.vehicle_id,
    start_date: r.start_date,
    start_time: (r.start_time || "").slice(0, 5),
    end_date: r.end_date,
    end_time: (r.end_time || "").slice(0, 5),
    status: r.status as string,
    admin_note: r.admin_note || "",
  });

  // 다른 예약이 들어오면 폼 초기화
  useEffect(() => {
    setEditMode(false);
    setEditForm({
      vehicle_id: r.vehicle_id,
      start_date: r.start_date,
      start_time: (r.start_time || "").slice(0, 5),
      end_date: r.end_date,
      end_time: (r.end_time || "").slice(0, 5),
      status: r.status,
      admin_note: r.admin_note || "",
    });
  }, [r.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function getAdminName(id: string | null): string {
    if (!id) return "";
    return admins.find((a) => a.id === id)?.name || "";
  }

  function canTransition(nextStatus: string): boolean {
    const required = statusRequiredRole[nextStatus] || [];
    // 등록 정의가 없는 상태(pending/cancelled)는 super_admin/manager/emergency 만
    if (required.length === 0) {
      return ["super_admin", "manager", "emergency"].includes(adminRole);
    }
    return required.includes(adminRole);
  }

  async function saveEdit() {
    // 유효성 검사
    if (
      !editForm.vehicle_id ||
      !editForm.start_date ||
      !editForm.start_time ||
      !editForm.end_date ||
      !editForm.end_time ||
      !editForm.status
    ) {
      toast.error("필수 항목을 모두 입력해 주세요");
      return;
    }
    if (
      editForm.end_date < editForm.start_date ||
      (editForm.end_date === editForm.start_date && editForm.end_time <= editForm.start_time)
    ) {
      toast.error("반납일시는 대여일시 이후여야 합니다");
      return;
    }

    // 상태 변경 권한 체크
    const statusChanged = editForm.status !== r.status;
    if (statusChanged && !canTransition(editForm.status)) {
      toast.error(`'${statusLabel[editForm.status] || editForm.status}'(으)로 변경할 권한이 없습니다`);
      return;
    }

    // 수정 전 확인
    const summary: string[] = [];
    if (editForm.vehicle_id !== r.vehicle_id) summary.push("• 차량 변경");
    if (editForm.start_date !== r.start_date || editForm.start_time !== (r.start_time || "").slice(0, 5))
      summary.push("• 대여일시 변경");
    if (editForm.end_date !== r.end_date || editForm.end_time !== (r.end_time || "").slice(0, 5))
      summary.push("• 반납일시 변경");
    if (statusChanged)
      summary.push(`• 상태: ${statusLabel[r.status] || r.status} → ${statusLabel[editForm.status] || editForm.status}`);
    if (editForm.admin_note !== (r.admin_note || ""))
      summary.push("• 관리자 메모 변경");

    const ok = await confirm({
      title: "예약 정보 수정",
      message:
        summary.length > 0
          ? `다음 변경사항을 저장하시겠습니까?\n\n${summary.join("\n")}`
          : "변경 사항이 없습니다. 그대로 저장하시겠습니까?",
      confirmText: "저장",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        id: r.id,
        admin_id: adminId,
        vehicle_id: editForm.vehicle_id,
        start_date: editForm.start_date,
        start_time: editForm.start_time + ":00",
        end_date: editForm.end_date,
        end_time: editForm.end_time + ":00",
      };
      // 상태가 바뀌면 status 와 함께 admin_note 도 보냄
      if (statusChanged) {
        body.status = editForm.status;
      }
      // 메모는 항상 본문에 포함 (status 변경 여부와 무관하게 저장 가능하도록)
      if (editForm.admin_note !== (r.admin_note || "")) {
        body.admin_note = editForm.admin_note;
      }

      const res = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "수정에 실패했습니다");
      } else {
        toast.success("저장되었습니다");
        setEditMode(false);
        onUpdated();
        onClose();
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (adminRole !== "super_admin") {
      toast.error("최고관리자만 삭제할 수 있습니다");
      return;
    }
    const ok = await confirm({
      title: "예약 삭제",
      message: `"${r.guest_name}"님의 예약을 완전히 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`,
      confirmText: "삭제",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/reservations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, admin_id: adminId, admin_role: adminRole }),
      });
      if (res.ok) {
        toast.success("예약이 삭제되었습니다");
        onUpdated();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error || "삭제 실패");
      }
    } catch {
      toast.error("서버 오류");
    }
  }

  function handlePrint() {
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
      const imgs = photos
        .map(
          (p) =>
            `<img src="${p.photo_url}" style="width:70px;height:70px;object-fit:cover;border:1px solid #ccc;border-radius:4px;" />`
        )
        .join("");
      return `<div style="flex:1;min-width:0;"><span style="font-size:10px;font-weight:600;color:#555;">${label}</span><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">${imgs}</div></div>`;
    }

    const printHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>차량 예약 확인서 - ${r.guest_name}</title>
<style>@page{size:A4;margin:15mm 18mm}*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222;line-height:1.35;font-size:11px}.page{width:100%;max-height:257mm;overflow:hidden;display:flex;flex-direction:column}.header{text-align:center;border-bottom:2px double #333;padding-bottom:8px;margin-bottom:10px}.header h1{font-size:18px;font-weight:700;letter-spacing:6px}.header-meta{display:flex;justify-content:space-between;align-items:center;margin-top:4px}.header .org{font-size:11px;color:#666}.print-date{font-size:10px;color:#999}.content{flex:1}.row2{display:flex;gap:8px;margin-bottom:6px}.row2>div{flex:1}.section{margin-bottom:6px}.section-title{font-size:10px;font-weight:700;color:#333;background:#f0f0f0;padding:3px 8px;margin-bottom:4px;border-left:2px solid #333}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:3px 7px;text-align:left}th{background:#fafafa;font-weight:600;width:70px;color:#555;white-space:nowrap}td{color:#222}.approval-box{display:flex;gap:8px;margin-bottom:6px}.approval-card{flex:1;border:1px solid #ccc;text-align:center;padding:8px 4px}.approval-card .title{font-size:10px;color:#666;font-weight:600;margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:3px}.approval-card .stamp{font-size:16px;font-weight:700;color:#1a7f37}.approval-card .name{font-size:10px;color:#444;margin-top:2px}.approval-card .date{font-size:9px;color:#999}.approval-card .pending{font-size:11px;color:#bbb;padding:6px 0}.status-badge{display:inline-block;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600}.status-approved{background:#dcfce7;color:#166534}.status-pending{background:#fef9c3;color:#854d0e}.status-rejected{background:#fecaca;color:#991b1b}.status-in_use{background:#dbeafe;color:#1e40af}.status-returned{background:#ede9fe;color:#5b21b6}.status-staff_approved{background:#d1fae5;color:#065f46}.memo-box{border:1px solid #ccc;padding:4px 7px;font-size:11px;color:#333;min-height:20px}.footer{text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:6px;margin-top:auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}.page{height:257mm}}@media screen{.page{max-width:210mm;margin:0 auto;padding:15mm 18mm;border:1px solid #ddd;background:#fff}}</style></head><body>
<div class="page"><div class="header"><h1>차량 예약 확인서</h1><div class="header-meta"><span class="org">한국중앙교회 차량관리</span><span class="print-date">출력일: ${new Date().toLocaleDateString("ko-KR")} ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span></div></div>
<div class="content"><div style="margin-bottom:8px;"><span class="status-badge status-${r.status}">${statusLabel[r.status] || r.status}</span><span style="font-size:10px;color:#999;margin-left:6px;">신청일: ${new Date(r.created_at).toLocaleString("ko-KR")}</span></div>
<div class="row2"><div class="section"><div class="section-title">신청자 정보</div><table><tr><th>이름</th><td>${r.guest_name}</td></tr><tr><th>부서</th><td>${r.department}</td></tr><tr><th>연락처</th><td>${r.phone}</td></tr>${r.driver_name ? `<tr><th>운전자</th><td>${r.driver_name}</td></tr>` : ""}</table></div>
<div class="section"><div class="section-title">차량 정보</div><table><tr><th>차량명</th><td>${vehicleName}</td></tr><tr><th>차량번호</th><td>${plateNumber}</td></tr><tr><th>차종</th><td>${vehicleType}</td></tr></table></div></div>
<div class="section"><div class="section-title">사용 일정</div><table><tr><th>대여</th><td>${r.start_date} ${r.start_time?.slice(0, 5) || ""}</td><th>반납</th><td>${r.end_date} ${r.end_time?.slice(0, 5) || ""}</td></tr><tr><th>행선지</th><td>${r.destination || "-"}</td><th>탑승인원</th><td>${r.passenger_count ? r.passenger_count + "명" : "-"}</td></tr>${r.purpose ? `<tr><th>사용목적</th><td colspan="3">${r.purpose}</td></tr>` : ""}${r.picked_up_at || r.returned_at ? `<tr><th>실제대여</th><td>${r.picked_up_at ? new Date(r.picked_up_at).toLocaleString("ko-KR") : "-"}</td><th>실제반납</th><td>${r.returned_at ? new Date(r.returned_at).toLocaleString("ko-KR") : "-"}</td></tr>` : ""}</table></div>
${r.admin_note ? `<div class="section"><div class="section-title">관리자 메모</div><div class="memo-box">${r.admin_note}</div></div>` : ""}
<div class="section"><div class="section-title">승인 현황</div><div class="approval-box"><div class="approval-card"><div class="title">차량담당 장로 승인</div>${r.staff_approved_at ? `<div class="stamp">승인</div><div class="name">${staffName}</div><div class="date">${new Date(r.staff_approved_at).toLocaleDateString("ko-KR")}</div>` : `<div class="pending">미승인</div>`}</div><div class="approval-card"><div class="title">기획장로 승인</div>${r.manager_approved_at ? `<div class="stamp">승인</div><div class="name">${managerName}</div><div class="date">${new Date(r.manager_approved_at).toLocaleDateString("ko-KR")}</div>` : `<div class="pending">미승인</div>`}</div></div></div>
${hasPhotos ? `<div class="section"><div class="section-title">차량 사진</div><div style="display:flex;gap:12px;padding:4px 0;">${buildPhotoHtml(pickupPhotos, "대여 시")}${buildPhotoHtml(returnPhotos, "반납 시")}</div></div>` : ""}
<div style="margin-top:8px;"><table><tr><th style="width:70px;">신청인</th><td style="height:32px;"></td><th style="width:70px;">확인자</th><td style="height:32px;"></td></tr></table></div></div>
<div class="footer">본 문서는 한국중앙교회 차량관리 시스템에서 자동 생성되었습니다.</div></div>
<div class="no-print" style="text-align:center;margin-top:16px;"><button onclick="window.print()" style="padding:8px 28px;background:#4f46e5;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;">인쇄하기</button><button onclick="window.close()" style="padding:8px 28px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;margin-left:8px;">닫기</button></div></body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(printHtml);
      w.document.close();
    }
  }

  const pickupPhotos = (r.reservation_photos || []).filter((p) => p.photo_type === "pickup");
  const returnPhotos = (r.reservation_photos || []).filter((p) => p.photo_type === "return");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate">예약 상세</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {r.vehicles?.name} · {r.start_date}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={r.status} />
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="px-4 py-4 space-y-4">
          {/* 신청자 정보 */}
          <Section title="신청자 정보">
            <DetailRow label="신청자" value={`${r.guest_name} (${r.department})`} />
            <DetailRow label="연락처" value={r.phone} />
            {r.driver_name && <DetailRow label="운전자" value={r.driver_name} />}
            {r.passenger_count !== null && r.passenger_count !== undefined && (
              <DetailRow label="탑승인원" value={`${r.passenger_count}명`} />
            )}
          </Section>

          {/* 사용 일정 / 차량 (편집 가능) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-400">사용 일정 / 차량</h4>
              {!editMode && adminRole !== "member" && (
                <button
                  onClick={() => setEditMode(true)}
                  className="text-[11px] font-medium text-primary-600 hover:text-primary-700 px-2 py-0.5 rounded-md hover:bg-primary-50 transition-colors"
                >
                  ✏ 수정
                </button>
              )}
            </div>

            {!editMode ? (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                <DetailRow
                  label="차량"
                  value={`${r.vehicles?.name || "-"}${r.vehicles?.plate_number ? ` (${r.vehicles.plate_number})` : ""}`}
                />
                <DetailRow
                  label="차종"
                  value={vehicleTypeLabel[r.vehicles?.type || ""] || r.vehicles?.type || "-"}
                />
                {r.vehicles?.category && (
                  <DetailRow
                    label="분류"
                    value={categoryLabel[r.vehicles.category] || r.vehicles.category}
                  />
                )}
                <DetailRow label="대여" value={`${r.start_date} ${r.start_time?.slice(0, 5)}`} />
                <DetailRow label="반납" value={`${r.end_date} ${r.end_time?.slice(0, 5)}`} />
                {r.destination && <DetailRow label="행선지" value={r.destination} />}
                {r.purpose && <DetailRow label="사용목적" value={r.purpose} />}
                {r.picked_up_at && (
                  <DetailRow label="실제 대여" value={new Date(r.picked_up_at).toLocaleString("ko-KR")} />
                )}
                {r.returned_at && (
                  <DetailRow label="실제 반납" value={new Date(r.returned_at).toLocaleString("ko-KR")} />
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                <Field label="차량 *">
                  <select
                    value={editForm.vehicle_id}
                    onChange={(e) => setEditForm((p) => ({ ...p, vehicle_id: e.target.value }))}
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
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="대여일 *">
                    <input
                      type="date"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm((p) => ({ ...p, start_date: e.target.value }))}
                      className="input-field !py-2 text-sm"
                    />
                  </Field>
                  <Field label="대여시간 *">
                    <input
                      type="time"
                      value={editForm.start_time}
                      onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))}
                      className="input-field !py-2 text-sm"
                    />
                  </Field>
                  <Field label="반납일 *">
                    <input
                      type="date"
                      value={editForm.end_date}
                      min={editForm.start_date}
                      onChange={(e) => setEditForm((p) => ({ ...p, end_date: e.target.value }))}
                      className="input-field !py-2 text-sm"
                    />
                  </Field>
                  <Field label="반납시간 *">
                    <input
                      type="time"
                      value={editForm.end_time}
                      onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))}
                      className="input-field !py-2 text-sm"
                    />
                  </Field>
                </div>

                {/* 상태 변경 (편집 모드 안에 통합) */}
                <Field label="상태 *">
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                    className="input-field !py-2 text-sm"
                  >
                    {ALL_STATUSES.map((s) => {
                      const allowed = s.value === r.status || canTransition(s.value);
                      return (
                        <option key={s.value} value={s.value} disabled={!allowed}>
                          {s.label}
                          {!allowed ? " (권한 없음)" : ""}
                          {s.value === r.status ? " (현재)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <Field label="관리자 메모 (선택)">
                  <textarea
                    value={editForm.admin_note}
                    onChange={(e) => setEditForm((p) => ({ ...p, admin_note: e.target.value }))}
                    placeholder="변경 사유 등"
                    rows={2}
                    className="input-field !py-2 text-sm resize-none"
                  />
                </Field>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditMode(false)}
                    disabled={saving}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  ※ 차량 중복 예약 검사는 수행하지 않습니다. 일정 충돌은 캘린더에서 확인해 주세요.
                </p>
              </div>
            )}
          </div>

          {/* 승인 현황 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2">승인 현황</h4>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex gap-3">
                <ApprovalBlock
                  title="1차 승인 (차량담당 장로)"
                  approvedAt={r.staff_approved_at}
                  approverName={getAdminName(r.staff_approved_by)}
                  color="emerald"
                />
                <div className="w-px bg-gray-200" />
                <ApprovalBlock
                  title="2차 승인 (기획장로)"
                  approvedAt={r.manager_approved_at}
                  approverName={getAdminName(r.manager_approved_by)}
                  color="green"
                />
              </div>
            </div>
          </div>

          {/* 첨부 사진 */}
          {(pickupPhotos.length > 0 || returnPhotos.length > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">첨부 사진</h4>
              <div className="space-y-2">
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
            </div>
          )}

          {/* 관리자 메모 (보기 모드) */}
          {!editMode && r.admin_note && (
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-xs text-yellow-700">📝 {r.admin_note}</p>
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-center pt-1">
            신청일: {new Date(r.created_at).toLocaleString("ko-KR")}
          </p>
        </div>

        {/* 푸터 */}
        {!editMode && (
          <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 px-4 py-3 flex gap-2 safe-area-bottom">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              문서 출력
            </button>
            {adminRole === "super_admin" && (
              <button
                onClick={handleDelete}
                className="py-2.5 px-4 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            )}
            <button
              onClick={onClose}
              className="py-2.5 px-5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 보조 컴포넌트들 =====
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 mb-2">{title}</h4>
      <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">{children}</div>
    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ApprovalBlock({
  title,
  approvedAt,
  approverName,
  color,
}: {
  title: string;
  approvedAt: string | null;
  approverName: string;
  color: "emerald" | "green";
}) {
  const ok = !!approvedAt;
  const textColor = color === "emerald" ? "text-emerald-600" : "text-green-600";
  return (
    <div className="flex-1 text-center">
      <div className={`text-xs font-bold ${ok ? textColor : "text-gray-300"}`}>
        {ok ? "✓ 승인" : "⏳ 대기"}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">{title}</div>
      {ok && (
        <>
          {approverName && (
            <div className={`text-[10px] font-medium ${textColor}`}>{approverName}</div>
          )}
          <div className="text-[10px] text-gray-400">
            {new Date(approvedAt!).toLocaleDateString("ko-KR")}
          </div>
        </>
      )}
    </div>
  );
}

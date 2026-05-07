"use client";

import { useState, useEffect } from "react";

interface LogEntry {
  id: string;
  admin_name: string;
  action: string;
  target_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  admin_add: "관리자 추가",
  admin_delete: "관리자 삭제",
  admin_edit: "관리자 수정",
  reservation_delete: "예약 삭제",
  reservation_status_change: "상태 변경",
  vehicle_add: "차량 추가",
  vehicle_delete: "차량 삭제",
  vehicle_edit: "차량 수정",
  vehicle_status_change: "차량 상태",
  sms_settings_change: "SMS 설정",
};

const ACTION_COLORS: Record<string, string> = {
  admin_add: "bg-green-100 text-green-700",
  admin_delete: "bg-red-100 text-red-700",
  admin_edit: "bg-blue-100 text-blue-700",
  reservation_delete: "bg-red-100 text-red-700",
  reservation_status_change: "bg-yellow-100 text-yellow-700",
  vehicle_add: "bg-green-100 text-green-700",
  vehicle_delete: "bg-red-100 text-red-700",
  vehicle_edit: "bg-blue-100 text-blue-700",
  vehicle_status_change: "bg-orange-100 text-orange-700",
  sms_settings_change: "bg-purple-100 text-purple-700",
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/admin/logs?limit=50");
      const data = await res.json();
      if (res.ok) {
        setLogs(Array.isArray(data) ? data : []);
      } else {
        setError(data.error || "로그 조회 실패");
      }
    } catch (e) {
      setError("서버 연결 실패");
    }
    setLoading(false);
  }

  function getDetailText(log: LogEntry): string {
    const d = log.details;
    switch (log.action) {
      case "admin_add":
        return `"${d.added_name}" (${d.added_login_id})`;
      case "admin_delete":
        return `"${d.deleted_name}" (${d.deleted_login_id})`;
      case "admin_edit":
        if (d.changed === "password") return "비밀번호 변경";
        if (typeof d.is_active === "boolean") return d.is_active ? "활성화" : "비활성화";
        return "정보 수정";
      case "reservation_delete":
        return `${d.guest_name} - ${d.vehicle_name} (${d.start_date})`;
      case "reservation_status_change": {
        const STATUS_KO: Record<string, string> = {
          pending: "대기",
          staff_approved: "1차승인",
          approved: "최종승인",
          rejected: "반려",
          in_use: "대여중",
          returned: "반납완료",
          cancelled: "취소",
        };
        const statusKo = STATUS_KO[d.new_status as string] || String(d.new_status);
        return `${d.guest_name} → ${statusKo}`;
      }
      case "vehicle_add":
        return `"${d.vehicle_name}" (${d.plate_number})`;
      case "vehicle_delete":
        return `"${d.vehicle_name}" (${d.plate_number})`;
      case "vehicle_edit":
        return `"${d.vehicle_name}" 정보 수정`;
      case "vehicle_status_change":
        return `"${d.vehicle_name}" → ${d.available ? "사용가능" : "사용불가"}`;
      case "sms_settings_change":
        if (d.mode) return `모드 변경: ${d.mode}`;
        if (d.template_changed) return "메시지 템플릿 변경";
        return "설정 변경";
      default:
        return JSON.stringify(d);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`;
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
          <span className="text-sm">📋</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">활동 로그</h3>
          <p className="text-[10px] text-gray-400">관리자 주요 활동 기록</p>
        </div>
      </div>

      {error ? (
        <div className="text-xs text-red-500 text-center py-4">
          <p>⚠️ {error}</p>
          <p className="text-[10px] text-gray-400 mt-1">Supabase에서 admin_logs 테이블을 생성해 주세요</p>
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">기록된 활동이 없습니다</p>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap mt-0.5 ${
                ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"
              }`}>
                {ACTION_LABELS[log.action] || log.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 truncate">
                  {getDetailText(log)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {log.admin_name} · {formatTime(log.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

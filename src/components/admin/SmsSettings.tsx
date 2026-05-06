"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Props {
  adminId: string;
}

export default function SmsSettings({ adminId }: Props) {
  const [mode, setMode] = useState<"free" | "paid">("free");
  const [todaySent, setTodaySent] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/admin/sms-settings");
      const data = await res.json();
      if (res.ok) {
        setMode(data.mode);
        setTodaySent(data.today_sent);
        setDailyLimit(data.daily_limit);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function toggleMode() {
    const newMode = mode === "free" ? "paid" : "free";

    if (newMode === "paid") {
      if (!confirm("유료 모드로 전환하면 발송 건수 제한 없이 SMS가 발송됩니다.\n건당 비용이 발생합니다. 전환하시겠습니까?")) {
        return;
      }
    }

    setToggling(true);
    try {
      const res = await fetch("/api/admin/sms-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode, admin_id: adminId }),
      });

      if (res.ok) {
        setMode(newMode);
        toast.success(newMode === "free" ? "무료 모드로 전환됨 (일 50건)" : "유료 모드로 전환됨 (무제한)");
      } else {
        const data = await res.json();
        toast.error(data.error || "변경 실패");
      }
    } catch {
      toast.error("서버 오류");
    }
    setToggling(false);
  }

  if (loading) return null;

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
            <span className="text-lg">💬</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">SMS 알림 설정</h3>
            <p className="text-xs text-gray-500">
              {mode === "free"
                ? `무료 모드 · 오늘 ${todaySent}/${dailyLimit}건 사용`
                : `유료 모드 · 오늘 ${todaySent}건 발송 (무제한)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            mode === "free" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
          }`}>
            {mode === "free" ? "무료" : "유료"}
          </span>
          <button
            onClick={toggleMode}
            disabled={toggling}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              mode === "paid" ? "bg-orange-400" : "bg-green-400"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                mode === "paid" ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {mode === "free" && todaySent >= dailyLimit && (
        <div className="mt-2 px-3 py-1.5 bg-red-50 rounded-lg">
          <p className="text-[11px] text-red-600">오늘 무료 한도를 모두 사용했습니다. 유료 모드로 전환하면 계속 발송 가능합니다.</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Props {
  adminId: string;
}

const DEFAULT_TEMPLATE = "[차량부] 예약 승인 완료\\n차량: {vehicle}\\n기간: {start}~{end}\\n안전 운행하세요!";

const VARIABLES = [
  { key: "{name}", label: "신청자명" },
  { key: "{vehicle}", label: "차량명" },
  { key: "{start}", label: "시작일" },
  { key: "{end}", label: "종료일" },
  { key: "{department}", label: "부서" },
];

export default function SmsSettings({ adminId }: Props) {
  const [mode, setMode] = useState<"free" | "paid">("free");
  const [todaySent, setTodaySent] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [tempTemplate, setTempTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // 테스트 발송
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; diagnostics: string[]; error?: string } | null>(null);

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
        if (data.message_template) {
          setMessageTemplate(data.message_template);
        }
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

  function startEditTemplate() {
    setTempTemplate(messageTemplate);
    setEditingTemplate(true);
  }

  function insertVariable(varKey: string) {
    setTempTemplate((prev) => prev + varKey);
  }

  async function saveTemplate() {
    if (!tempTemplate.trim()) {
      toast.error("메시지 내용을 입력해 주세요");
      return;
    }

    setSavingTemplate(true);
    try {
      const res = await fetch("/api/admin/sms-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_template: tempTemplate, admin_id: adminId }),
      });

      if (res.ok) {
        setMessageTemplate(tempTemplate);
        setEditingTemplate(false);
        toast.success("메시지 템플릿이 저장되었습니다");
      } else {
        const data = await res.json();
        toast.error(data.error || "저장 실패");
      }
    } catch {
      toast.error("서버 오류");
    }
    setSavingTemplate(false);
  }

  // 테스트 발송
  async function handleTestSms() {
    if (!testPhone.trim()) {
      toast.error("수신 번호를 입력해 주세요");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/sms-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success("테스트 SMS 발송 성공!");
      } else {
        toast.error("발송 실패 - 아래 진단 결과를 확인하세요");
      }
    } catch {
      setTestResult({ success: false, diagnostics: ["서버 연결 실패"], error: "서버 오류" });
      toast.error("서버 오류");
    }
    setTesting(false);
  }

  // 미리보기 생성
  function getPreview(template: string): string {
    return template
      .replace(/\{name\}/g, "홍길동")
      .replace(/\{vehicle\}/g, "스타렉스 1호")
      .replace(/\{start\}/g, "2026-05-10")
      .replace(/\{end\}/g, "2026-05-11")
      .replace(/\{department\}/g, "청년부")
      .replace(/\{phone\}/g, "010-1234-5678")
      .replace(/\\n/g, "\n");
  }

  if (loading) return null;

  return (
    <div className="card mb-4 space-y-3">
      {/* 상단: 모드 토글 */}
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
        <div className="px-3 py-1.5 bg-red-50 rounded-lg">
          <p className="text-[11px] text-red-600">오늘 무료 한도를 모두 사용했습니다. 유료 모드로 전환하면 계속 발송 가능합니다.</p>
        </div>
      )}

      {/* 구분선 */}
      <div className="border-t border-gray-100" />

      {/* 메시지 템플릿 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-500">발송 메시지</h4>
          {!editingTemplate && (
            <button
              onClick={startEditTemplate}
              className="text-[11px] text-primary-600 font-medium hover:text-primary-700"
            >
              수정
            </button>
          )}
        </div>

        {editingTemplate ? (
          <div className="space-y-2">
            {/* 변수 버튼들 */}
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  className="text-[10px] px-2 py-1 bg-primary-50 text-primary-700 rounded-md hover:bg-primary-100 transition-colors"
                >
                  {v.key} {v.label}
                </button>
              ))}
              <button
                onClick={() => insertVariable("\\n")}
                className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
              >
                ↵ 줄바꿈
              </button>
            </div>

            {/* 편집 영역 */}
            <textarea
              value={tempTemplate}
              onChange={(e) => setTempTemplate(e.target.value)}
              rows={4}
              className="input-field text-xs resize-none font-mono"
              placeholder="메시지를 입력하세요"
            />

            {/* 미리보기 */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 mb-1">미리보기</p>
              <p className="text-xs text-gray-700 whitespace-pre-line">{getPreview(tempTemplate)}</p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => setEditingTemplate(false)}
                className="flex-1 py-2 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setTempTemplate(DEFAULT_TEMPLATE);
                }}
                className="py-2 px-3 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                기본값
              </button>
              <button
                onClick={saveTemplate}
                disabled={savingTemplate}
                className="flex-1 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                {savingTemplate ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          /* 읽기 모드 */
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-700 whitespace-pre-line">{getPreview(messageTemplate)}</p>
          </div>
        )}
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-100" />

      {/* 테스트 발송 */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 mb-2">테스트 발송</h4>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="수신번호 (010-0000-0000)"
            className="input-field !py-2 text-xs flex-1"
          />
          <button
            onClick={handleTestSms}
            disabled={testing}
            className="px-4 py-2 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap"
          >
            {testing ? "발송 중..." : "테스트"}
          </button>
        </div>

        {/* 진단 결과 */}
        {testResult && (
          <div className={`mt-2 rounded-xl p-3 ${testResult.success ? "bg-green-50" : "bg-red-50"}`}>
            <p className={`text-xs font-bold mb-1.5 ${testResult.success ? "text-green-700" : "text-red-700"}`}>
              {testResult.success ? "✅ 발송 성공" : `❌ 발송 실패: ${testResult.error}`}
            </p>
            <div className="space-y-0.5">
              {testResult.diagnostics.map((d, i) => (
                <p key={i} className="text-[10px] text-gray-600 font-mono">{d}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

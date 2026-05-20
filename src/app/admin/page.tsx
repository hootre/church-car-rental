"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import ReservationStatus from "@/components/admin/ReservationStatus";
import ReservationHistory from "@/components/admin/ReservationHistory";
import VehicleManagement from "@/components/admin/VehicleManagement";
import AdminManagement from "@/components/admin/AdminManagement";
import CalendarView from "@/components/admin/CalendarView";
import SmsSettings from "@/components/admin/SmsSettings";
import AdminLogs from "@/components/admin/AdminLogs";
import { roleLabel, supabase } from "@/lib/supabase";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { autoRegisterPush } from "@/lib/push-client";

type Tab = "calendar" | "status" | "history" | "vehicles" | "admins";

interface AdminSession {
  id: string;
  login_id: string;
  name: string;
  role: "super_admin" | "staff" | "manager" | "member";
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("calendar");
  const [pendingCount, setPendingCount] = useState(0);
  const [staffApprovedCount, setStaffApprovedCount] = useState(0);
  const [pushDenied, setPushDenied] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<string | null>(null);
  const [pushTesting, setPushTesting] = useState(false);

  const fetchPendingCount = useCallback(async () => {
    const { count: pending } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: staffApproved } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("status", "staff_approved");

    setPendingCount(pending || 0);
    setStaffApprovedCount(staffApproved || 0);
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchPendingCount();
      // 로그인 상태면 자동으로 푸시 알림 등록 시도
      autoRegisterPush();
      // 알림 권한 차단 상태 감지
      if ("Notification" in window && Notification.permission === "denied") {
        setPushDenied(true);
      }
    }
  }, [authenticated, fetchPendingCount]);

  useEffect(() => {
    // localStorage(로그인 유지) 먼저 확인, 없으면 sessionStorage
    const stored = localStorage.getItem("admin_session") || sessionStorage.getItem("admin_session");
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setAdminSession(session);
        setAuthenticated(true);
      } catch {
        localStorage.removeItem("admin_session");
        sessionStorage.removeItem("admin_session");
      }
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      toast.error("아이디와 비밀번호를 입력해 주세요");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId.trim(), password }),
      });

      const data = await res.json();

      if (res.ok) {
        const session: AdminSession = {
          id: data.admin.id,
          login_id: data.admin.login_id,
          name: data.admin.name,
          role: data.admin.role,
        };
        if (rememberMe) {
          localStorage.setItem("admin_session", JSON.stringify(session));
        } else {
          sessionStorage.setItem("admin_session", JSON.stringify(session));
        }
        setAdminSession(session);
        setAuthenticated(true);
        toast.success(`${session.name}님 환영합니다`);
      } else {
        toast.error(data.error || "로그인에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    // 서버에서 JWT 쿠키 삭제
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch { /* ignore */ }
    localStorage.removeItem("admin_session");
    sessionStorage.removeItem("admin_session");
    setAdminSession(null);
    setAuthenticated(false);
    setLoginId("");
    setPassword("");
    toast.success("로그아웃 되었습니다");
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pb-24">
        <Header />
        <main className="max-w-lg mx-auto px-4 pt-12">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">관리자 로그인</h2>
            <p className="text-sm text-gray-500 mt-1">아이디와 비밀번호를 입력해 주세요</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
              <input type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)}
                placeholder="관리자 아이디" className="input-field" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호" className="input-field" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">로그인 유지</span>
            </label>
            <button type="submit" disabled={authLoading || !loginId || !password} className="btn-primary">
              {authLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

        </main>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string; superOnly?: boolean }[] = [
    { key: "calendar", label: "일정", icon: "📅" },
    { key: "status", label: "현황", icon: "📋" },
    { key: "history", label: "내역", icon: "📜" },
    { key: "vehicles", label: "차량", icon: "🚗" },
    { key: "admins", label: "관리자", icon: "👤", superOnly: true },
  ];

  async function handlePushTest() {
    setPushTesting(true);
    setPushTestResult(null);
    try {
      // 1단계: 브라우저 알림 권한 확인
      const perm = "Notification" in window ? Notification.permission : "unsupported";
      if (perm !== "granted") {
        setPushTestResult(`알림 권한: ${perm} (허용 필요)`);
        setPushTesting(false);
        return;
      }

      // 2단계: SW 구독 상태 확인
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      const myEndpoint = sub ? sub.endpoint.slice(0, 80) : "없음";

      if (!sub) {
        setPushTestResult(`이 기기 구독: 없음\nSW 상태: ${reg ? "등록됨" : "미등록"}\n→ 페이지 새로고침 후 재시도`);
        setPushTesting(false);
        return;
      }

      // 3단계: 서버 푸시 테스트 API 호출
      const res = await fetch("/api/admin/push-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      const data = await res.json();
      const subsDetail = (data.subscriptions || [])
        .map((s: { platform: string; endpoint_prefix: string }) => {
          const isMe = myEndpoint === s.endpoint_prefix;
          return `${isMe ? "★ " : "  "}[${s.platform}] ${s.endpoint_prefix}`;
        })
        .join("\n");

      // 이 기기 endpoint가 서버 목록에 있는지 확인
      const myInServer = (data.subscriptions || []).some(
        (s: { endpoint_prefix: string }) => myEndpoint === s.endpoint_prefix
      );

      setPushTestResult(
        `발송: ${data.sentCount || 0}/${data.subCount || 0}명 | VAPID: ${data.debug?.vapidReady ? "OK" : "FAIL"}\n이 기기: ${myInServer ? "서버에 등록됨 ✓" : "⚠️ 서버에 미등록!"}\n내 endpoint: ${myEndpoint}\n--- 서버 구독 목록 (★=이 기기) ---\n${subsDetail}`
      );
    } catch (err) {
      setPushTestResult(`오류: ${err}`);
    }
    setPushTesting(false);
  }

  const visibleTabs = tabs.filter(
    (t) => !t.superOnly || adminSession?.role === "super_admin"
  );

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="max-w-2xl md:max-w-full mx-auto px-3 md:px-8 pt-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">관리자</h2>
            <p className="text-xs text-gray-500">
              {adminSession?.name} ({roleLabel[adminSession?.role || ""] || adminSession?.role})
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handlePushTest} disabled={pushTesting}
              className="text-xs text-gray-400 hover:text-purple-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-purple-50">
              {pushTesting ? "테스트중..." : "🔔 알림테스트"}
            </button>
            <button onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50">
              로그아웃
            </button>
          </div>
        </div>

        {/* 알림 테스트 결과 */}
        {pushTestResult && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
            <span className="text-xs text-gray-700 flex-1 font-mono whitespace-pre-wrap break-all">{pushTestResult}</span>
            <button onClick={() => setPushTestResult(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* 알림 차단 안내 */}
        {pushDenied && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-800">알림이 차단되어 있습니다</p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                새 예약 알림을 받으려면 주소창 왼쪽 🔒 아이콘 → 알림 → &ldquo;허용&rdquo;으로 변경 후 새로고침해 주세요
              </p>
            </div>
            <button onClick={() => setPushDenied(false)} className="text-amber-400 hover:text-amber-600 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 overflow-x-auto scrollbar-hide">
          {visibleTabs.map((tab) => {
            // 현황 탭의 미처리 건수(1차 + 2차 대기) 합산 뱃지
            const totalPending =
              tab.key === "status" ? pendingCount + staffApprovedCount : 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 min-w-0 py-2 px-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap text-center inline-flex items-center justify-center gap-1 ${
                  activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                {totalPending > 0 && (
                  <span
                    className="absolute top-0 right-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] bg-orange-500 text-white text-[9px] font-bold rounded-full px-1 shadow-sm leading-none"
                    title={`1차 대기 ${pendingCount}건 + 2차 대기 ${staffApprovedCount}건`}
                  >
                    {totalPending}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "calendar" && adminSession && <CalendarView adminId={adminSession.id} adminRole={adminSession.role} />}
        {activeTab === "status" && adminSession && (
          <ReservationStatus adminId={adminSession.id} adminRole={adminSession.role} />
        )}
        {activeTab === "history" && <ReservationHistory adminRole={adminSession?.role} adminId={adminSession?.id} />}
        {activeTab === "vehicles" && adminSession && <VehicleManagement adminId={adminSession.id} adminName={adminSession.name} adminRole={adminSession.role} />}
        {activeTab === "admins" && adminSession?.role === "super_admin" && (
          <>
            {/* SMS 설정은 FEATURE_FLAGS.SMS_ENABLED=true 일 때만 노출 */}
            {FEATURE_FLAGS.SMS_ENABLED && <SmsSettings adminId={adminSession.id} />}
            <AdminManagement currentAdminId={adminSession.id} currentAdminRole={adminSession.role} currentAdminName={adminSession.name} />
            <AdminLogs />
          </>
        )}
      </main>
    </div>
  );
}

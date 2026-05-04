"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import ReservationStatus from "@/components/admin/ReservationStatus";
import ReservationHistory from "@/components/admin/ReservationHistory";
import VehicleManagement from "@/components/admin/VehicleManagement";
import AdminManagement from "@/components/admin/AdminManagement";
import CalendarView from "@/components/admin/CalendarView";
import { roleLabel } from "@/lib/supabase";

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
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("calendar");

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_session");
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setAdminSession(session);
        setAuthenticated(true);
      } catch {
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
        sessionStorage.setItem("admin_session", JSON.stringify(session));
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

  function handleLogout() {
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
            <button type="submit" disabled={authLoading || !loginId || !password} className="btn-primary">
              {authLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <p className="mt-6 text-xs text-gray-400 text-center">
            초기 계정: admin / admin1234
          </p>
        </main>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string; superOnly?: boolean }[] = [
    { key: "calendar", label: "일정", icon: "📅" },
    { key: "status", label: "예약현황", icon: "📋" },
    { key: "history", label: "예약내역", icon: "📜" },
    { key: "vehicles", label: "차량관리", icon: "🚗" },
    { key: "admins", label: "관리자", icon: "👤", superOnly: true },
  ];

  const visibleTabs = tabs.filter(
    (t) => !t.superOnly || adminSession?.role === "super_admin"
  );

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="max-w-2xl md:max-w-full mx-auto px-4 md:px-8 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">관리자</h2>
            <p className="text-xs text-gray-500">
              {adminSession?.name} ({roleLabel[adminSession?.role || ""] || adminSession?.role})
            </p>
          </div>
          <button onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
            로그아웃
          </button>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              <span className="mr-1">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {activeTab === "calendar" && <CalendarView />}
        {activeTab === "status" && adminSession && (
          <ReservationStatus adminId={adminSession.id} adminRole={adminSession.role} />
        )}
        {activeTab === "history" && <ReservationHistory />}
        {activeTab === "vehicles" && <VehicleManagement />}
        {activeTab === "admins" && adminSession?.role === "super_admin" && (
          <AdminManagement currentAdminId={adminSession.id} />
        )}
      </main>
    </div>
  );
}

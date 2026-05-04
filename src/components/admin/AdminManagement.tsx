"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Admin, roleLabel } from "@/lib/supabase";

interface Props {
  currentAdminId: string;
}

export default function AdminManagement({ currentAdminId }: Props) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // 새 관리자 폼
  const [form, setForm] = useState({
    login_id: "",
    password: "",
    password_confirm: "",
    name: "",
    role: "member" as "member" | "staff" | "manager" | "emergency" | "super_admin",
  });

  // 비밀번호 변경 폼
  const [changingPwId, setChangingPwId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins");
      const data = await res.json();
      if (res.ok) {
        setAdmins(data);
      } else {
        toast.error("관리자 목록을 불러오지 못했습니다");
      }
    } catch {
      toast.error("서버 오류");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // 관리자 추가
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.login_id.trim() || !form.password || !form.name.trim()) {
      toast.error("모든 필수 항목을 입력해 주세요");
      return;
    }
    if (form.password !== form.password_confirm) {
      toast.error("비밀번호가 일치하지 않습니다");
      return;
    }
    if (form.password.length < 4) {
      toast.error("비밀번호는 4자 이상이어야 합니다");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: form.login_id.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("관리자가 추가되었습니다");
        setShowForm(false);
        setForm({ login_id: "", password: "", password_confirm: "", name: "", role: "member" });
        fetchAdmins();
      } else {
        toast.error(data.error || "추가에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류");
    }
    setSaving(false);
  }

  // 비밀번호 변경
  async function handleChangePassword(adminId: string) {
    if (!newPassword) {
      toast.error("새 비밀번호를 입력해 주세요");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("비밀번호는 4자 이상이어야 합니다");
      return;
    }

    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminId, password: newPassword }),
      });

      if (res.ok) {
        toast.success("비밀번호가 변경되었습니다");
        setChangingPwId(null);
        setNewPassword("");
        setNewPasswordConfirm("");
      } else {
        const data = await res.json();
        toast.error(data.error || "변경에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류");
    }
  }

  // 관리자 삭제
  async function handleDelete(admin: Admin) {
    if (admin.id === currentAdminId) {
      toast.error("자기 자신은 삭제할 수 없습니다");
      return;
    }
    if (!confirm(`"${admin.name}" 관리자를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id }),
      });

      if (res.ok) {
        toast.success("삭제되었습니다");
        fetchAdmins();
      } else {
        const data = await res.json();
        toast.error(data.error || "삭제에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류");
    }
  }

  // 활성화 토글
  async function toggleActive(admin: Admin) {
    if (admin.id === currentAdminId) {
      toast.error("자기 자신은 비활성화할 수 없습니다");
      return;
    }

    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id, is_active: !admin.is_active }),
      });

      if (res.ok) {
        fetchAdmins();
      } else {
        toast.error("변경에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류");
    }
  }

  // 역할별 아바타 색상
  function getRoleColor(role: string) {
    switch (role) {
      case "super_admin": return "bg-purple-100 text-purple-700";
      case "manager": return "bg-orange-100 text-orange-700";
      case "staff": return "bg-primary-100 text-primary-700";
      case "emergency": return "bg-red-100 text-red-700";
      case "member": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-700";
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case "super_admin": return "bg-purple-100 text-purple-700";
      case "manager": return "bg-orange-100 text-orange-700";
      case "staff": return "bg-blue-100 text-blue-700";
      case "emergency": return "bg-red-100 text-red-700";
      case "member": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          총 <span className="font-bold text-gray-900">{admins.length}</span>명
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          관리자 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <form onSubmit={handleAdd} className="card mb-4 space-y-3">
          <h3 className="font-bold text-gray-900 text-sm">새 관리자 등록</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">아이디 *</label>
              <input
                type="text"
                value={form.login_id}
                onChange={(e) => setForm((p) => ({ ...p, login_id: e.target.value }))}
                placeholder="영문/숫자"
                className="input-field !py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">이름 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="관리자 이름"
                className="input-field !py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">비밀번호 *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="4자 이상"
                className="input-field !py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">비밀번호 확인 *</label>
              <input
                type="password"
                value={form.password_confirm}
                onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))}
                placeholder="비밀번호 재입력"
                className="input-field !py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">권한</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "member" | "staff" | "manager" | "emergency" | "super_admin" }))}
              className="input-field !py-2 text-sm"
            >
              <option value="member">부원 (조회만)</option>
              <option value="staff">차량담당 장로 (1차 승인)</option>
              <option value="manager">기획장로 (최종 승인)</option>
              <option value="emergency">긴급승인자 (1차+2차 승인)</option>
              <option value="super_admin">최고관리자 (모든 권한)</option>
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-outline !py-2 text-sm"
            >
              취소
            </button>
            <button type="submit" disabled={saving} className="btn-primary !py-2 text-sm">
              {saving ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

      {/* 관리자 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">👤</div>
          <p className="text-gray-500 text-sm">등록된 관리자가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div key={admin.id} className="card">
              <div className="flex items-center gap-3">
                {/* 아바타 */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getRoleColor(admin.role)}`}
                >
                  {admin.name.charAt(0)}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">{admin.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getRoleBadgeColor(admin.role)}`}
                    >
                      {roleLabel[admin.role]}
                    </span>
                    {!admin.is_active && (
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                        비활성
                      </span>
                    )}
                    {admin.id === currentAdminId && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        나
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    @{admin.login_id}
                    {admin.last_login_at &&
                      ` · 최근 로그인: ${new Date(admin.last_login_at).toLocaleDateString("ko-KR")}`}
                  </p>
                </div>

                {/* 액션 */}
                {admin.id !== currentAdminId && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(admin)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        admin.is_active ? "bg-green-400" : "bg-gray-300"
                      }`}
                      title={admin.is_active ? "비활성화" : "활성화"}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          admin.is_active ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(admin)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* 비밀번호 변경 */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                {changingPwId === admin.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="새 비밀번호"
                        className="input-field !py-1.5 text-xs"
                      />
                      <input
                        type="password"
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        placeholder="비밀번호 확인"
                        className="input-field !py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setChangingPwId(null);
                          setNewPassword("");
                          setNewPasswordConfirm("");
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleChangePassword(admin.id)}
                        className="text-xs text-primary-600 font-semibold hover:text-primary-700"
                      >
                        변경 확인
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setChangingPwId(admin.id)}
                    className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
                  >
                    비밀번호 변경
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

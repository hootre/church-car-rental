"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  supabase, Vehicle, VehicleInsurance, VehicleMaintenance, Reservation,
  vehicleTypeLabel, maintenanceTypeLabel, categoryLabel, statusLabel,
} from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";

type ViewMode = "list" | "detail";
type DetailTab = "info" | "insurance" | "maintenance" | "history";
type VehicleStatus = "available" | "in_use" | "unavailable";

interface VehicleFormData {
  name: string;
  type: string;
  plate_number: string;
  year: number;
  capacity: number;
  description: string;
  age_limit: string;
  category: "shared" | "personal";
  insurance_company: string;
  insurance_phone: string;
  insurance_expiry: string;
  insurance_agent: string;
  insurance_agent_phone: string;
}

const statusConfig: Record<VehicleStatus, { label: string; bg: string; text: string }> = {
  available: { label: "사용가능", bg: "bg-green-100", text: "text-green-700" },
  in_use: { label: "사용중", bg: "bg-blue-100", text: "text-blue-700" },
  unavailable: { label: "사용불가", bg: "bg-red-100", text: "text-red-700" },
};

// ========== InfoRow 컴포넌트 ==========
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

// ========== VehicleForm 컴포넌트 ==========
interface VehicleFormProps {
  form: VehicleFormData;
  setForm: React.Dispatch<React.SetStateAction<VehicleFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel: () => void;
}

function VehicleForm({ form, setForm, onSubmit, submitLabel, onCancel }: VehicleFormProps) {
  return (
    <form onSubmit={onSubmit} className="card space-y-3 mb-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">차량명 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="예: 쏠라티 1호차"
            className="input-field !py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">차량번호 *</label>
          <input
            type="text"
            value={form.plate_number}
            onChange={(e) => setForm((p) => ({ ...p, plate_number: e.target.value }))}
            placeholder="12가 3456"
            className="input-field !py-2 text-sm"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">차종</label>
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            className="input-field !py-2 text-sm"
          >
            {Object.entries(vehicleTypeLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">분류</label>
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as "shared" | "personal" }))}
            className="input-field !py-2 text-sm"
          >
            <option value="shared">공유차량</option>
            <option value="personal">개인차량</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">연식</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => setForm((p) => ({ ...p, year: parseInt(e.target.value) || 2024 }))}
            className="input-field !py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">정원</label>
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => setForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 5 }))}
            className="input-field !py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">연령제한</label>
          <input
            type="text"
            value={form.age_limit}
            onChange={(e) => setForm((p) => ({ ...p, age_limit: e.target.value }))}
            placeholder="26세 이상"
            className="input-field !py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">비고</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="참고사항"
            className="input-field !py-2 text-sm"
          />
        </div>
      </div>

      {/* 보험 정보 */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400 mb-2">보험 정보 (선택)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={form.insurance_company}
            onChange={(e) => setForm((p) => ({ ...p, insurance_company: e.target.value }))}
            placeholder="보험사"
            className="input-field !py-2 text-sm"
          />
          <input
            type="text"
            value={form.insurance_phone}
            onChange={(e) => setForm((p) => ({ ...p, insurance_phone: e.target.value }))}
            placeholder="사고접수 번호"
            className="input-field !py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <input
            type="date"
            value={form.insurance_expiry}
            onChange={(e) => setForm((p) => ({ ...p, insurance_expiry: e.target.value }))}
            className="input-field !py-2 text-sm"
            title="보험만기일"
          />
          <input
            type="text"
            value={form.insurance_agent}
            onChange={(e) => setForm((p) => ({ ...p, insurance_agent: e.target.value }))}
            placeholder="설계사"
            className="input-field !py-2 text-sm"
          />
          <input
            type="text"
            value={form.insurance_agent_phone}
            onChange={(e) => setForm((p) => ({ ...p, insurance_agent_phone: e.target.value }))}
            placeholder="설계사 연락처"
            className="input-field !py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-outline !py-2 text-sm">
          취소
        </button>
        <button type="submit" className="btn-primary !py-2 text-sm">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ========== VehicleCard 컴포넌트 ==========
interface VehicleCardProps {
  v: Vehicle;
  status: VehicleStatus;
  onLoadDetail: (vehicle: Vehicle) => void;
  onToggleAvailable: (vehicle: Vehicle) => void;
}

function VehicleCard({ v, status, onLoadDetail, onToggleAvailable }: VehicleCardProps) {
  const cfg = statusConfig[status];

  return (
    <div className="card !p-3">
      <div className="flex items-center justify-between">
        <button onClick={() => onLoadDetail(v)} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {v.type === "bus" ? "🚌" : v.type === "van" ? "🚐" : v.type === "truck" ? "🚛" : "🚗"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-bold text-sm text-gray-900">{v.name}</h4>
                {v.category === "personal" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    개인
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {v.plate_number} · {v.year}년식 · {v.capacity}인승
              </p>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
          {status !== "in_use" && (
            <button
              onClick={() => onToggleAvailable(v)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                v.available
                  ? "border-red-200 text-red-500 hover:bg-red-50"
                  : "border-green-200 text-green-600 hover:bg-green-50"
              }`}
            >
              {v.available ? "사용불가로" : "사용가능으로"}
            </button>
          )}
        </div>
      </div>
      {v.insurance_company && (
        <div className="mt-1.5 text-[10px] text-gray-400">
          보험: {v.insurance_company} (만기: {v.insurance_expiry})
        </div>
      )}
    </div>
  );
}

// ========== Main Component ==========
export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");

  // 현재 사용중인 차량 ID 목록
  const [inUseVehicleIds, setInUseVehicleIds] = useState<Set<string>>(new Set());

  // 보험/정비 데이터
  const [insurances, setInsurances] = useState<VehicleInsurance[]>([]);
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([]);
  const [usageHistory, setUsageHistory] = useState<Reservation[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 추가/수정 폼
  const [showInsuranceForm, setShowInsuranceForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);

  // 차량 수정 폼 데이터
  const [editForm, setEditForm] = useState<VehicleFormData>({
    name: "",
    type: "sedan",
    plate_number: "",
    year: 2024,
    capacity: 5,
    description: "",
    age_limit: "",
    category: "shared",
    insurance_company: "",
    insurance_phone: "",
    insurance_expiry: "",
    insurance_agent: "",
    insurance_agent_phone: "",
  });

  // 차량 추가 폼 데이터
  const [addForm, setAddForm] = useState<VehicleFormData>({
    name: "",
    type: "sedan",
    plate_number: "",
    year: 2024,
    capacity: 5,
    description: "",
    age_limit: "",
    category: "shared",
    insurance_company: "",
    insurance_phone: "",
    insurance_expiry: "",
    insurance_agent: "",
    insurance_agent_phone: "",
  });

  const fetchInUseVehicles = useCallback(async () => {
    const { data } = await supabase
      .from("reservations")
      .select("vehicle_id")
      .eq("status", "in_use");
    setInUseVehicleIds(new Set((data || []).map((r) => r.vehicle_id)));
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("sort_order", { ascending: true });

    setLoading(false);
    if (error) toast.error("차량 목록을 불러오지 못했습니다");
    else setVehicles(data || []);
  }, []);

  useEffect(() => {
    fetchVehicles();
    fetchInUseVehicles();
  }, [fetchVehicles, fetchInUseVehicles]);

  function getVehicleStatus(vehicle: Vehicle): VehicleStatus {
    if (!vehicle.available) return "unavailable";
    if (inUseVehicleIds.has(vehicle.id)) return "in_use";
    return "available";
  }

  // 차량 상세 로드
  async function loadVehicleDetail(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setViewMode("detail");
    setDetailTab("info");
    setEditingInfo(false);
    setLoadingDetail(true);

    const [insRes, maintRes, histRes] = await Promise.all([
      supabase.from("vehicle_insurance").select("*").eq("vehicle_id", vehicle.id).order("end_date", { ascending: false }),
      supabase.from("vehicle_maintenance").select("*").eq("vehicle_id", vehicle.id).order("maintenance_date", { ascending: false }),
      supabase.from("reservations").select("*").eq("vehicle_id", vehicle.id).order("start_date", { ascending: false }),
    ]);

    setInsurances(insRes.data || []);
    setMaintenances(maintRes.data || []);
    setUsageHistory(histRes.data || []);
    setLoadingDetail(false);
  }

  // 차량 사용가능/사용불가 토글
  async function toggleAvailable(vehicle: Vehicle) {
    if (inUseVehicleIds.has(vehicle.id) && vehicle.available) {
      toast.error("사용중인 차량은 사용불가로 변경할 수 없습니다");
      return;
    }
    const { error } = await supabase
      .from("vehicles")
      .update({ available: !vehicle.available })
      .eq("id", vehicle.id);

    if (error) toast.error("변경 실패");
    else {
      toast.success(!vehicle.available ? "사용가능으로 변경됨" : "사용불가로 변경됨");
      fetchVehicles();
    }
  }

  // ===== 차량 추가 =====
  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.plate_number.trim()) {
      toast.error("차량명과 차량번호는 필수입니다");
      return;
    }

    const maxSort = vehicles.length > 0 ? Math.max(...vehicles.map((v) => v.sort_order)) : 0;

    const { error } = await supabase.from("vehicles").insert({
      name: addForm.name.trim(),
      type: addForm.type,
      plate_number: addForm.plate_number.trim(),
      year: addForm.year,
      capacity: addForm.capacity,
      description: addForm.description.trim() || null,
      age_limit: addForm.age_limit.trim() || null,
      category: addForm.category,
      insurance_company: addForm.insurance_company.trim() || null,
      insurance_phone: addForm.insurance_phone.trim() || null,
      insurance_expiry: addForm.insurance_expiry || null,
      insurance_agent: addForm.insurance_agent.trim() || null,
      insurance_agent_phone: addForm.insurance_agent_phone.trim() || null,
      available: true,
      sort_order: maxSort + 1,
    });

    if (error) {
      toast.error("차량 추가에 실패했습니다");
      console.error(error);
    } else {
      toast.success("차량이 추가되었습니다");
      setShowAddVehicle(false);
      setAddForm({
        name: "",
        type: "sedan",
        plate_number: "",
        year: 2024,
        capacity: 5,
        description: "",
        age_limit: "",
        category: "shared",
        insurance_company: "",
        insurance_phone: "",
        insurance_expiry: "",
        insurance_agent: "",
        insurance_agent_phone: "",
      });
      fetchVehicles();
    }
  }

  // ===== 차량 정보 수정 =====
  function startEditInfo() {
    if (!selectedVehicle) return;
    setEditForm({
      name: selectedVehicle.name,
      type: selectedVehicle.type,
      plate_number: selectedVehicle.plate_number,
      year: selectedVehicle.year,
      capacity: selectedVehicle.capacity,
      description: selectedVehicle.description || "",
      age_limit: selectedVehicle.age_limit || "",
      category: selectedVehicle.category || "shared",
      insurance_company: selectedVehicle.insurance_company || "",
      insurance_phone: selectedVehicle.insurance_phone || "",
      insurance_expiry: selectedVehicle.insurance_expiry || "",
      insurance_agent: selectedVehicle.insurance_agent || "",
      insurance_agent_phone: selectedVehicle.insurance_agent_phone || "",
    });
    setEditingInfo(true);
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicle) return;
    if (!editForm.name.trim() || !editForm.plate_number.trim()) {
      toast.error("차량명과 차량번호는 필수입니다");
      return;
    }

    const { error } = await supabase
      .from("vehicles")
      .update({
        name: editForm.name.trim(),
        type: editForm.type,
        plate_number: editForm.plate_number.trim(),
        year: editForm.year,
        capacity: editForm.capacity,
        description: editForm.description.trim() || null,
        age_limit: editForm.age_limit.trim() || null,
        category: editForm.category,
        insurance_company: editForm.insurance_company.trim() || null,
        insurance_phone: editForm.insurance_phone.trim() || null,
        insurance_expiry: editForm.insurance_expiry || null,
        insurance_agent: editForm.insurance_agent.trim() || null,
        insurance_agent_phone: editForm.insurance_agent_phone.trim() || null,
      })
      .eq("id", selectedVehicle.id);

    if (error) {
      toast.error("수정에 실패했습니다");
    } else {
      toast.success("차량 정보가 수정되었습니다");
      setEditingInfo(false);
      fetchVehicles();
      const { data } = await supabase.from("vehicles").select("*").eq("id", selectedVehicle.id).single();
      if (data) setSelectedVehicle(data);
    }
  }

  // ===== 차량 삭제 =====
  async function handleDeleteVehicle() {
    if (!selectedVehicle) return;
    if (!confirm(`"${selectedVehicle.name}" 차량을 삭제하시겠습니까?\n관련 보험/정비 내역도 함께 삭제됩니다.`)) return;

    const { data: activeRes } = await supabase
      .from("reservations")
      .select("id")
      .eq("vehicle_id", selectedVehicle.id)
      .in("status", ["pending", "staff_approved", "approved", "in_use"]);

    if (activeRes && activeRes.length > 0) {
      toast.error("진행중인 예약이 있어 삭제할 수 없습니다");
      return;
    }

    await supabase.from("vehicle_insurance").delete().eq("vehicle_id", selectedVehicle.id);
    await supabase.from("vehicle_maintenance").delete().eq("vehicle_id", selectedVehicle.id);
    const { error } = await supabase.from("vehicles").delete().eq("id", selectedVehicle.id);

    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      toast.success("차량이 삭제되었습니다");
      setViewMode("list");
      setSelectedVehicle(null);
      fetchVehicles();
    }
  }

  // 보험 추가
  async function handleAddInsurance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedVehicle) return;
    const fd = new FormData(e.currentTarget);

    const { error } = await supabase.from("vehicle_insurance").insert({
      vehicle_id: selectedVehicle.id,
      insurance_company: (fd.get("company") as string) || "",
      end_date: (fd.get("end_date") as string) || "",
      coverage_type: (fd.get("coverage_type") as string) || "종합보험",
      agent_name: (fd.get("agent_name") as string) || null,
      agent_phone: (fd.get("agent_phone") as string) || null,
      accident_phone: (fd.get("accident_phone") as string) || null,
      premium: parseInt(fd.get("premium") as string) || 0,
      memo: (fd.get("memo") as string) || null,
    });

    if (error) toast.error("보험 추가 실패");
    else {
      toast.success("보험 내역이 추가되었습니다");
      setShowInsuranceForm(false);
      loadVehicleDetail(selectedVehicle);
    }
  }

  // 정비 추가
  async function handleAddMaintenance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedVehicle) return;
    const fd = new FormData(e.currentTarget);

    const { error } = await supabase.from("vehicle_maintenance").insert({
      vehicle_id: selectedVehicle.id,
      maintenance_date: (fd.get("date") as string) || "",
      maintenance_type: (fd.get("type") as string) || "",
      description: (fd.get("description") as string) || "",
      cost: parseInt(fd.get("cost") as string) || 0,
      mileage: parseInt(fd.get("mileage") as string) || null,
      shop_name: (fd.get("shop") as string) || null,
      memo: (fd.get("memo") as string) || null,
    });

    if (error) toast.error("정비 추가 실패");
    else {
      toast.success("정비 내역이 추가되었습니다");
      setShowMaintenanceForm(false);
      loadVehicleDetail(selectedVehicle);
    }
  }

  async function deleteInsurance(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("vehicle_insurance").delete().eq("id", id);
    toast.success("삭제됨");
    if (selectedVehicle) loadVehicleDetail(selectedVehicle);
  }

  async function deleteMaintenance(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("vehicle_maintenance").delete().eq("id", id);
    toast.success("삭제됨");
    if (selectedVehicle) loadVehicleDetail(selectedVehicle);
  }

  // 상태별 차량 수
  const statusCounts = vehicles.reduce(
    (acc, v) => {
      acc[getVehicleStatus(v)]++;
      return acc;
    },
    { available: 0, in_use: 0, unavailable: 0 } as Record<VehicleStatus, number>
  );

  // 카테고리별 분류
  const sharedVehicles = vehicles.filter((v) => (v.category || "shared") === "shared");
  const personalVehicles = vehicles.filter((v) => v.category === "personal");

  // ========== 리스트 뷰 ==========
  if (viewMode === "list") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">
            차량 목록 <span className="text-sm font-normal text-gray-400">({vehicles.length}대)</span>
          </h3>
          <button
            onClick={() => setShowAddVehicle(!showAddVehicle)}
            className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            차량 추가
          </button>
        </div>

        {/* 차량 추가 폼 */}
        {showAddVehicle && (
          <>
            <h4 className="font-bold text-sm text-gray-900 mb-2">새 차량 등록</h4>
            <VehicleForm
              form={addForm}
              setForm={setAddForm}
              onSubmit={handleAddVehicle}
              submitLabel="등록"
              onCancel={() => setShowAddVehicle(false)}
            />
          </>
        )}

        {/* 상태 요약 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-green-50 rounded-xl p-2.5 text-center">
            <div className="text-lg font-bold text-green-700">{statusCounts.available}</div>
            <div className="text-[10px] text-green-600">사용가능</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-2.5 text-center">
            <div className="text-lg font-bold text-blue-700">{statusCounts.in_use}</div>
            <div className="text-[10px] text-blue-600">사용중</div>
          </div>
          <div className="bg-red-50 rounded-xl p-2.5 text-center">
            <div className="text-lg font-bold text-red-700">{statusCounts.unavailable}</div>
            <div className="text-[10px] text-red-600">사용불가</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
        ) : (
          <>
            {/* 공유차량 섹션 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-bold text-sm text-gray-900">공유차량</h4>
                <span className="text-xs text-gray-400">({sharedVehicles.length}대)</span>
              </div>
              {sharedVehicles.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">공유차량이 없습니다</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sharedVehicles.map((v) => (
                    <VehicleCard
                      key={v.id}
                      v={v}
                      status={getVehicleStatus(v)}
                      onLoadDetail={loadVehicleDetail}
                      onToggleAvailable={toggleAvailable}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 개인차량 섹션 */}
            {personalVehicles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-gray-900">개인차량</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      비공유
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">({personalVehicles.length}대)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {personalVehicles.map((v) => (
                    <VehicleCard
                      key={v.id}
                      v={v}
                      status={getVehicleStatus(v)}
                      onLoadDetail={loadVehicleDetail}
                      onToggleAvailable={toggleAvailable}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ========== 상세 뷰 ==========
  if (!selectedVehicle) return null;

  const selectedStatus = getVehicleStatus(selectedVehicle);
  const selectedCfg = statusConfig[selectedStatus];

  return (
    <div>
      {/* 뒤로가기 */}
      <button
        onClick={() => {
          setViewMode("list");
          setSelectedVehicle(null);
          setEditingInfo(false);
        }}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        차량 목록
      </button>

      {/* 차량 헤더 */}
      <div className="card mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">
            {selectedVehicle.type === "bus"
              ? "🚌"
              : selectedVehicle.type === "van"
                ? "🚐"
                : selectedVehicle.type === "truck"
                  ? "🚛"
                  : "🚗"}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg text-gray-900">{selectedVehicle.name}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selectedCfg.bg} ${selectedCfg.text}`}>
                {selectedCfg.label}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  (selectedVehicle.category || "shared") === "shared"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {categoryLabel[selectedVehicle.category || "shared"]}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {selectedVehicle.plate_number} · {selectedVehicle.year}년식 · {vehicleTypeLabel[selectedVehicle.type]} ·
              {selectedVehicle.capacity}인승
            </p>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {(
          [
            { key: "info", label: "기본정보" },
            { key: "insurance", label: "보험내역" },
            { key: "maintenance", label: "정비내역" },
            { key: "history", label: "사용기록" },
          ] as { key: DetailTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setDetailTab(tab.key);
              setEditingInfo(false);
            }}
            className={`flex-1 py-2 px-2 text-sm font-medium rounded-lg transition-all ${
              detailTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loadingDetail ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : (
        <>
          {/* ===== 기본정보 탭 ===== */}
          {detailTab === "info" && !editingInfo && (
            <div>
              <div className="card space-y-2">
                <InfoRow label="차량명" value={selectedVehicle.name} />
                <InfoRow label="차량번호" value={selectedVehicle.plate_number} />
                <InfoRow label="차종" value={vehicleTypeLabel[selectedVehicle.type] || selectedVehicle.type} />
                <InfoRow label="분류" value={categoryLabel[selectedVehicle.category || "shared"]} />
                <InfoRow label="연식" value={`${selectedVehicle.year}년`} />
                <InfoRow label="승차정원" value={`${selectedVehicle.capacity}명`} />
                <InfoRow label="연령제한" value={selectedVehicle.age_limit || "-"} />
                {selectedVehicle.description && <InfoRow label="비고" value={selectedVehicle.description} />}
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <p className="text-xs text-gray-400 mb-1">현재 보험</p>
                  <InfoRow label="보험사" value={selectedVehicle.insurance_company || "-"} />
                  <InfoRow label="사고접수" value={selectedVehicle.insurance_phone || "-"} />
                  <InfoRow label="만기일" value={selectedVehicle.insurance_expiry || "-"} />
                  <InfoRow
                    label="설계사"
                    value={`${selectedVehicle.insurance_agent || "-"} (${selectedVehicle.insurance_agent_phone || "-"})`}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={startEditInfo}
                  className="flex-1 py-2 bg-primary-50 text-primary-600 text-sm font-medium rounded-xl hover:bg-primary-100 transition-colors"
                >
                  정보 수정
                </button>
                <button
                  onClick={handleDeleteVehicle}
                  className="py-2 px-4 bg-red-50 text-red-500 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          {/* ===== 기본정보 수정 모드 ===== */}
          {detailTab === "info" && editingInfo && (
            <VehicleForm
              form={editForm}
              setForm={setEditForm}
              onSubmit={handleSaveInfo}
              submitLabel="저장"
              onCancel={() => setEditingInfo(false)}
            />
          )}

          {/* ===== 보험내역 탭 ===== */}
          {detailTab === "insurance" && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-gray-500">{insurances.length}건</p>
                <button
                  onClick={() => setShowInsuranceForm(!showInsuranceForm)}
                  className="text-xs px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg font-medium"
                >
                  {showInsuranceForm ? "취소" : "+ 추가"}
                </button>
              </div>

              {showInsuranceForm && (
                <form onSubmit={handleAddInsurance} className="card !p-3 mb-3 space-y-2">
                  <input name="company" placeholder="보험사 *" required className="input-field text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="end_date" type="date" required className="input-field text-sm" />
                    <input name="coverage_type" placeholder="보장유형" defaultValue="종합보험" className="input-field text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="agent_name" placeholder="설계사" className="input-field text-sm" />
                    <input name="agent_phone" placeholder="설계사 연락처" className="input-field text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="accident_phone" placeholder="사고접수 번호" className="input-field text-sm" />
                    <input name="premium" type="number" placeholder="보험료(원)" className="input-field text-sm" />
                  </div>
                  <input name="memo" placeholder="메모" className="input-field text-sm" />
                  <button type="submit" className="btn-primary text-sm !py-2">
                    저장
                  </button>
                </form>
              )}

              {insurances.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">보험 내역이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {insurances.map((ins) => (
                    <div key={ins.id} className="card !p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-bold text-sm text-gray-900">{ins.insurance_company}</span>
                          <span className="text-xs text-gray-400 ml-2">{ins.coverage_type}</span>
                        </div>
                        <button onClick={() => deleteInsurance(ins.id)} className="text-xs text-red-400">
                          삭제
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>만기: {ins.end_date}</div>
                        {ins.agent_name && <div>설계사: {ins.agent_name} ({ins.agent_phone})</div>}
                        {ins.accident_phone && <div>사고접수: {ins.accident_phone}</div>}
                        {ins.premium > 0 && <div>보험료: {ins.premium.toLocaleString()}원</div>}
                        {ins.memo && <div className="text-gray-400">{ins.memo}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== 정비내역 탭 ===== */}
          {detailTab === "maintenance" && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-gray-500">{maintenances.length}건</p>
                <button
                  onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}
                  className="text-xs px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg font-medium"
                >
                  {showMaintenanceForm ? "취소" : "+ 추가"}
                </button>
              </div>

              {showMaintenanceForm && (
                <form onSubmit={handleAddMaintenance} className="card !p-3 mb-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input name="date" type="date" required className="input-field text-sm" />
                    <select name="type" className="input-field text-sm">
                      {Object.entries(maintenanceTypeLabel).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input name="description" placeholder="정비 내용 *" required className="input-field text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="cost" type="number" placeholder="비용(원)" className="input-field text-sm" />
                    <input name="mileage" type="number" placeholder="주행거리(km)" className="input-field text-sm" />
                  </div>
                  <input name="shop" placeholder="정비소" className="input-field text-sm" />
                  <input name="memo" placeholder="메모" className="input-field text-sm" />
                  <button type="submit" className="btn-primary text-sm !py-2">
                    저장
                  </button>
                </form>
              )}

              {maintenances.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">정비 내역이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {maintenances.map((m) => (
                    <div key={m.id} className="card !p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 mr-1">
                            {maintenanceTypeLabel[m.maintenance_type] || m.maintenance_type}
                          </span>
                          <span className="font-bold text-sm text-gray-900">{m.description}</span>
                        </div>
                        <button onClick={() => deleteMaintenance(m.id)} className="text-xs text-red-400">
                          삭제
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>날짜: {m.maintenance_date}</div>
                        {m.cost > 0 && <div>비용: {m.cost.toLocaleString()}원</div>}
                        {m.mileage && <div>주행거리: {m.mileage.toLocaleString()}km</div>}
                        {m.shop_name && <div>정비소: {m.shop_name}</div>}
                        {m.memo && <div className="text-gray-400">{m.memo}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== 사용기록 탭 ===== */}
          {detailTab === "history" && (
            <div>
              <p className="text-sm text-gray-500 mb-3">{usageHistory.length}건</p>

              {usageHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">사용 기록이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {usageHistory.map((res) => (
                    <div key={res.id} className="card !p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={res.status} />
                          <span className="font-bold text-sm text-gray-900">{res.guest_name}</span>
                        </div>
                        <span className="text-xs text-gray-400">{res.department}</span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>
                          기간: {res.start_date} ~ {res.end_date}
                        </div>
                        {res.purpose && <div>용도: {res.purpose}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

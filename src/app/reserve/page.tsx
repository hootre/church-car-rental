"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import VehicleCard from "@/components/VehicleCard";
import { supabase, Vehicle, vehicleTypeLabel } from "@/lib/supabase";

type Step = "schedule" | "vehicle" | "form" | "confirm";

export default function ReservePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("schedule");
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [selectedVehicles, setSelectedVehicles] = useState<Vehicle[]>([]);

  const [form, setForm] = useState({
    guest_name: "",
    phone: "",
    department: "",
    purpose: "",
    destination: "",
    start_date: "",
    start_time: "09:00",
    end_date: "",
    end_time: "18:00",
  });

  const [vehicleDetails, setVehicleDetails] = useState<
    Record<string, { driver_name: string; passenger_count: string }>
  >({});

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setForm((prev) => ({ ...prev, start_date: today, end_date: today }));
  }, []);

  const isScheduleValid = form.start_date && form.start_time && form.end_date && form.end_time;

  const isFormValid =
    form.guest_name.trim() &&
    form.phone.trim() &&
    form.department.trim() &&
    form.purpose.trim() &&
    form.destination.trim() &&
    selectedVehicles.every((v) => vehicleDetails[v.id]?.driver_name?.trim());

  async function fetchAvailableVehicles() {
    setLoading(true);
    setSelectedVehicles([]);
    setVehicleDetails({});

    const { data: allVehicles, error: vError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("available", true)
      .order("capacity", { ascending: false });

    if (vError) {
      toast.error("차량 목록을 불러오지 못했습니다");
      setLoading(false);
      return;
    }

    const { data: conflicting, error: rError } = await supabase
      .from("reservations")
      .select("vehicle_id")
      .in("status", ["pending", "staff_approved", "approved", "in_use"])
      .lte("start_date", form.end_date)
      .gte("end_date", form.start_date);

    if (rError) {
      toast.error("예약 현황을 확인하지 못했습니다");
      setLoading(false);
      return;
    }

    const unavailableIds = new Set(
      (conflicting || []).map((r: { vehicle_id: string }) => r.vehicle_id)
    );

    const available = (allVehicles || []).filter(
      (v) => !unavailableIds.has(v.id) && (v.category || "shared") !== "personal"
    );
    setAvailableVehicles(available);
    setLoading(false);
    setStep("vehicle");
  }

  const vehicleTypes = Array.from(new Set(availableVehicles.map((v) => v.type)));
  const filteredVehicles =
    filterType === "all"
      ? availableVehicles
      : availableVehicles.filter((v) => v.type === filterType);

  function toggleVehicleSelection(vehicle: Vehicle) {
    setSelectedVehicles((prev) => {
      const isSelected = prev.some((v) => v.id === vehicle.id);
      if (isSelected) {
        return prev.filter((v) => v.id !== vehicle.id);
      } else {
        return [...prev, vehicle];
      }
    });
  }

  function handleVehicleDetailChange(
    vehicleId: string,
    field: "driver_name" | "passenger_count",
    value: string
  ) {
    setVehicleDetails((prev) => ({
      ...prev,
      [vehicleId]: {
        ...prev[vehicleId],
        [field]: value,
      },
    }));
  }

  async function handleSubmit() {
    if (selectedVehicles.length === 0 || !isFormValid) return;

    setSubmitting(true);
    let successCount = 0;
    let failureCount = 0;

    for (const vehicle of selectedVehicles) {
      const details = vehicleDetails[vehicle.id];
      const { error } = await supabase.from("reservations").insert({
        vehicle_id: vehicle.id,
        guest_name: form.guest_name.trim(),
        phone: form.phone.trim(),
        department: form.department.trim(),
        purpose: form.purpose.trim(),
        destination: form.destination.trim(),
        passenger_count: details.passenger_count ? parseInt(details.passenger_count) : null,
        driver_name: details.driver_name.trim(),
        start_date: form.start_date,
        start_time: form.start_time,
        end_date: form.end_date,
        end_time: form.end_time,
      });

      if (error) {
        failureCount++;
      } else {
        successCount++;
      }
    }

    setSubmitting(false);

    if (failureCount > 0) {
      toast.error(
        `${successCount}건 예약이 완료되었으나, ${failureCount}건이 실패했습니다. 다시 시도해 주세요.`
      );
    } else {
      toast.success(`${successCount}건 예약이 신청되었습니다!`);
      router.push("/check");
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const steps: Step[] = ["schedule", "vehicle", "form", "confirm"];

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-6">
        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center mb-6">
          {steps.map((s, i) => (
            <div key={s} className={`flex items-center ${i < steps.length - 1 ? "flex-1 max-w-[80px]" : ""}`}>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                  step === s
                    ? "bg-primary-600 text-white"
                    : i < steps.indexOf(step)
                    ? "bg-primary-200 text-primary-700"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 rounded mx-2" />}
            </div>
          ))}
        </div>

        {/* Step 1: 일정 선택 */}
        {step === "schedule" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">대여 일정 선택</h2>
            <p className="text-sm text-gray-500 mb-4">사용일시를 먼저 정해 주세요</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">사용 시작일 *</label>
                  <input type="date" name="start_date" value={form.start_date} onChange={handleInput}
                    min={new Date().toISOString().split("T")[0]} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간 *</label>
                  <input type="time" name="start_time" value={form.start_time} onChange={handleInput} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">반납일 *</label>
                  <input type="date" name="end_date" value={form.end_date} onChange={handleInput}
                    min={form.start_date} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">반납 시간 *</label>
                  <input type="time" name="end_time" value={form.end_time} onChange={handleInput} className="input-field" />
                </div>
              </div>
            </div>
            {isScheduleValid && (
              <div className="mt-4 p-3 bg-primary-50 rounded-xl">
                <p className="text-sm text-primary-700 font-medium text-center">
                  {form.start_date} {form.start_time} ~ {form.end_date} {form.end_time}
                </p>
              </div>
            )}
            <div className="mt-6">
              <button onClick={fetchAvailableVehicles} disabled={!isScheduleValid || loading} className="btn-primary">
                {loading ? "조회 중..." : "가능한 차량 보기"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 차량 선택 */}
        {step === "vehicle" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">차량 선택</h2>
            <p className="text-sm text-gray-500 mb-2">선택 기간에 대여 가능한 차량입니다</p>
            <div className="mb-4 p-2.5 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 text-center">
                {form.start_date} {form.start_time} ~ {form.end_date} {form.end_time}
              </p>
            </div>

            {selectedVehicles.length > 0 && (
              <div className="mb-4 p-3 bg-primary-50 rounded-lg border border-primary-200">
                <p className="text-sm font-medium text-primary-700">
                  {selectedVehicles.length}대 선택됨
                </p>
              </div>
            )}

            {vehicleTypes.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                <button onClick={() => setFilterType("all")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filterType === "all" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>전체</button>
                {vehicleTypes.map((type) => (
                  <button key={type} onClick={() => setFilterType(type)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      filterType === type ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>{vehicleTypeLabel[type] || type}</button>
                ))}
              </div>
            )}

            {availableVehicles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">😔</div>
                <p className="text-gray-500 font-medium">해당 기간에 가능한 차량이 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">다른 날짜를 선택해 보세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle}
                    selected={selectedVehicles.some((v) => v.id === vehicle.id)}
                    onSelect={() => toggleVehicleSelection(vehicle)} />
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => { setStep("schedule"); setSelectedVehicles([]); setVehicleDetails({}); setFilterType("all"); }} className="btn-outline">이전</button>
              <button onClick={() => setStep("form")} disabled={selectedVehicles.length === 0} className="btn-primary">다음</button>
            </div>
          </div>
        )}

        {/* Step 3: 신청 정보 입력 */}
        {step === "form" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">차량 신청서 작성</h2>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-medium text-primary-600">{selectedVehicles.length}대의 차량</span>
              에 대한 정보를 입력해주세요
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사용목적 *</label>
                <textarea name="purpose" value={form.purpose} onChange={handleInput}
                  placeholder="예: 청년부 MT 이동, 어르신 심방, 수련회 짐 운반 등"
                  rows={2} className="input-field resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">행선지 *</label>
                <input type="text" name="destination" value={form.destination} onChange={handleInput}
                  placeholder="예: 양평 수련원, 서울역 등" className="input-field" />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-3">차량별 정보</p>
              </div>

              {selectedVehicles.map((vehicle) => (
                <div key={vehicle.id} className="card p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-3">
                    {vehicle.name} ({vehicle.capacity}인승)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">차량운전자 *</label>
                      <input type="text" value={vehicleDetails[vehicle.id]?.driver_name || ""}
                        onChange={(e) => handleVehicleDetailChange(vehicle.id, "driver_name", e.target.value)}
                        placeholder="운전자 이름" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">탑승인원</label>
                      <input type="number" value={vehicleDetails[vehicle.id]?.passenger_count || ""}
                        onChange={(e) => handleVehicleDetailChange(vehicle.id, "passenger_count", e.target.value)}
                        placeholder="0" min="1" className="input-field" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-3">신청자 정보</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">신청자 이름 *</label>
                <input type="text" name="guest_name" value={form.guest_name} onChange={handleInput}
                  placeholder="홍길동" className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 *</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleInput}
                  placeholder="010-0000-0000" className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">신청부서 *</label>
                <input type="text" name="department" value={form.department} onChange={handleInput}
                  placeholder="청년부, 교육부 등" className="input-field" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep("vehicle")} className="btn-outline">이전</button>
              <button onClick={() => setStep("confirm")} disabled={!isFormValid} className="btn-primary">다음</button>
            </div>
          </div>
        )}

        {/* Step 4: 확인 및 제출 */}
        {step === "confirm" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">신청 확인</h2>
            <p className="text-sm text-gray-500 mb-4">내용을 확인 후 신청해 주세요</p>

            <div className="card space-y-3">
              <ConfirmRow label="사용일시" value={`${form.start_date} ${form.start_time} ~ ${form.end_date} ${form.end_time}`} />
              <div className="border-t border-gray-100 my-2" />
              <ConfirmRow label="사용목적" value={form.purpose} />
              <ConfirmRow label="행선지" value={form.destination} />

              <div className="border-t border-gray-100 my-2" />
              <p className="text-xs text-gray-500 font-medium mb-2">차량 정보</p>

              {selectedVehicles.map((vehicle, idx) => (
                <div key={vehicle.id} className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {idx + 1}. {vehicle.name} ({vehicle.capacity}인승) - {vehicle.plate_number}
                  </p>
                  <div className="space-y-1 text-sm">
                    <ConfirmRow label="운전자" value={vehicleDetails[vehicle.id]?.driver_name || ""} />
                    {vehicleDetails[vehicle.id]?.passenger_count && (
                      <ConfirmRow label="탑승인원" value={`${vehicleDetails[vehicle.id].passenger_count}명`} />
                    )}
                  </div>
                </div>
              ))}

              <div className="border-t border-gray-100 my-2" />
              <ConfirmRow label="신청자" value={form.guest_name} />
              <ConfirmRow label="전화번호" value={form.phone} />
              <ConfirmRow label="신청부서" value={form.department} />
            </div>

            <p className="mt-4 text-xs text-gray-400 text-center">
              신청 후 차량담당 장로 → 기획장로 순서로 승인이 완료되면 차량을 이용하실 수 있습니다
            </p>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep("form")} className="btn-outline">수정</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                {submitting ? "신청 중..." : `${selectedVehicles.length}대 차량 신청`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right break-keep">{value}</span>
    </div>
  );
}

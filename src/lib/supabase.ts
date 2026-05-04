import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 차량 타입 한글 매핑
export const vehicleTypeLabel: Record<string, string> = {
  bus: "버스",
  van: "승합차",
  sedan: "승용차",
  suv: "SUV",
  truck: "화물차",
};

// 예약 상태 한글 매핑
export const statusLabel: Record<string, string> = {
  pending: "대기중",
  staff_approved: "차량담당 장로 승인",
  approved: "승인완료",
  rejected: "거절",
  cancelled: "예약취소",
  in_use: "대여중",
  returned: "반납완료",
};

export const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  staff_approved: "bg-emerald-100 text-emerald-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-orange-100 text-orange-800",
  in_use: "bg-blue-100 text-blue-800",
  returned: "bg-purple-100 text-purple-800",
};

// 상태 전이 규칙
// pending → staff_approved (차량담당 장로 승인) → approved (기획장로 승인) → in_use → returned
export const statusTransitions: Record<string, string[]> = {
  pending: ["staff_approved", "rejected"],
  staff_approved: ["approved", "rejected"],
  approved: ["in_use", "rejected"],
  in_use: ["returned"],
  rejected: [],
  cancelled: [],
  returned: [],
};

// 상태 변경 시 필요한 역할
// staff(차량담당 장로): 1차 승인, manager(기획장로): 2차(최종) 승인
// emergency(긴급승인자): 1차+2차 모두 가능
// member(부원): 승인 권한 없음 (조회만)
// super_admin: 모든 권한
export const statusRequiredRole: Record<string, string[]> = {
  staff_approved: ["staff", "manager", "emergency", "super_admin"],
  approved: ["manager", "emergency", "super_admin"],
  rejected: ["staff", "manager", "emergency", "super_admin"],
  in_use: ["staff", "manager", "emergency", "super_admin"],
  returned: ["staff", "manager", "emergency", "super_admin"],
};

// 타입 정의
export interface Vehicle {
  id: string;
  name: string;
  type: string;
  plate_number: string;
  year: number;
  capacity: number;
  description: string | null;
  insurance_company: string | null;
  insurance_phone: string | null;
  insurance_expiry: string | null;
  insurance_agent: string | null;
  insurance_agent_phone: string | null;
  age_limit: string | null;
  available: boolean;
  sort_order: number;
  category: "shared" | "personal";
}

// 차량 분류 한글 매핑
export const categoryLabel: Record<string, string> = {
  shared: "공유차량",
  personal: "개인차량",
};

export interface VehicleInsurance {
  id: string;
  vehicle_id: string;
  insurance_company: string;
  policy_number: string | null;
  start_date: string | null;
  end_date: string;
  premium: number;
  coverage_type: string;
  agent_name: string | null;
  agent_phone: string | null;
  accident_phone: string | null;
  memo: string | null;
  created_at: string;
}

export interface VehicleMaintenance {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  maintenance_type: string;
  description: string;
  cost: number;
  mileage: number | null;
  shop_name: string | null;
  memo: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  vehicle_id: string;
  guest_name: string;
  phone: string;
  department: string;
  purpose: string | null;
  destination: string | null;
  passenger_count: number | null;
  driver_name: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  status: "pending" | "staff_approved" | "approved" | "rejected" | "in_use" | "returned";
  admin_note: string | null;
  staff_approved_by: string | null;
  staff_approved_at: string | null;
  manager_approved_by: string | null;
  manager_approved_at: string | null;
  picked_up_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  vehicles?: Vehicle;
  reservation_photos?: ReservationPhoto[];
  staff_approver?: Admin;
  manager_approver?: Admin;
}

export interface ReservationPhoto {
  id: string;
  reservation_id: string;
  photo_type: "pickup" | "return";
  photo_url: string;
  memo: string | null;
  created_at: string;
}

export interface Admin {
  id: string;
  login_id: string;
  name: string;
  role: "super_admin" | "staff" | "manager" | "member" | "emergency";
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

// 관리자 역할 한글 매핑
export const roleLabel: Record<string, string> = {
  super_admin: "최고관리자",
  staff: "차량담당 장로",
  manager: "기획장로",
  emergency: "긴급승인자",
  member: "부원",
};

// 정비 유형
export const maintenanceTypeLabel: Record<string, string> = {
  일반정비: "일반정비",
  엔진오일: "엔진오일",
  타이어: "타이어",
  브레이크: "브레이크",
  배터리: "배터리",
  에어컨: "에어컨",
  사고수리: "사고수리",
  정기점검: "정기점검",
  기타: "기타",
};

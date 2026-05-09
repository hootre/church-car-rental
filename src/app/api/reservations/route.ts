import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyUserApproved } from "@/lib/notifications";
import { writeAdminLog } from "@/lib/admin-log";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 예약 목록 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");
  const name = searchParams.get("name");
  const status = searchParams.get("status");

  let query = supabase
    .from("reservations")
    .select("*, vehicles(*)")
    .order("created_at", { ascending: false });

  if (phone) query = query.eq("phone", phone);
  if (name) query = query.eq("guest_name", name);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 예약 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vehicle_id,
      guest_name,
      phone,
      department,
      purpose,
      destination,
      passenger_count,
      driver_name,
      start_date,
      start_time,
      end_date,
      end_time,
    } = body;

    // 필수 필드 검증
    if (!vehicle_id || !guest_name || !phone || !department || !start_date || !start_time || !end_date || !end_time) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해 주세요" },
        { status: 400 }
      );
    }

    // 해당 시간대 차량 중복 예약 확인
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .eq("vehicle_id", vehicle_id)
      .in("status", ["pending", "staff_approved", "approved", "in_use"])
      .lte("start_date", end_date)
      .gte("end_date", start_date);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: "해당 시간에 이미 예약된 차량입니다" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        vehicle_id,
        guest_name: guest_name.trim(),
        phone: phone.trim(),
        department: department.trim(),
        purpose: purpose?.trim() || null,
        destination: destination?.trim() || null,
        passenger_count: passenger_count || null,
        driver_name: driver_name?.trim() || null,
        start_date,
        start_time,
        end_date,
        end_time,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "요청 처리에 실패했습니다" },
      { status: 500 }
    );
  }
}

// 예약 상태 업데이트 (관리자)
// - status 만 보내면 상태 전이
// - vehicle_id / start_date / start_time / end_date / end_time 만 보내면 일정 수정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      status,
      admin_note,
      admin_id,
      vehicle_id,
      start_date,
      start_time,
      end_date,
      end_time,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다" },
        { status: 400 }
      );
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};

    // (0) 메모는 status 변경 여부와 무관하게 받음
    if (typeof admin_note === "string") {
      updateData.admin_note = admin_note || null;
    }

    // (1) 상태 전이
    if (status) {
      updateData.status = status;

      // 담당 승인 시
      if (status === "staff_approved" && admin_id) {
        updateData.staff_approved_by = admin_id;
        updateData.staff_approved_at = new Date().toISOString();
      }
      // 부장 최종 승인 시
      if (status === "approved" && admin_id) {
        updateData.manager_approved_by = admin_id;
        updateData.manager_approved_at = new Date().toISOString();
      }
      // 대여 시작 시
      if (status === "in_use") {
        updateData.picked_up_at = new Date().toISOString();
      }
      // 반납 시
      if (status === "returned") {
        updateData.returned_at = new Date().toISOString();
      }
    }

    // (2) 일정/차량 편집
    if (vehicle_id) updateData.vehicle_id = vehicle_id;
    if (start_date) updateData.start_date = start_date;
    if (start_time) updateData.start_time = start_time;
    if (end_date) updateData.end_date = end_date;
    if (end_time) updateData.end_time = end_time;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "변경할 내용이 없습니다" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select("*, vehicles(name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 최종 승인 시 사용자에게 SMS (status="approved" 인 경우에만)
    if (data && status === "approved") {
      notifyUserApproved({
        guest_name: data.guest_name,
        phone: data.phone,
        department: data.department,
        vehicle_name: data.vehicles?.name || "차량",
        start_date: data.start_date,
        end_date: data.end_date,
      }).catch((err) => console.error("[SMS] 사용자 알림 실패:", err));
    }

    // 활동 로그
    if (admin_id && data) {
      const { data: adminData } = await supabase
        .from("admins")
        .select("name")
        .eq("id", admin_id)
        .single();

      const isStatusChange = !!status;
      writeAdminLog({
        admin_id,
        admin_name: adminData?.name || "관리자",
        action: isStatusChange ? "reservation_status_change" : "reservation_edit",
        target_type: "reservation",
        target_id: id,
        details: isStatusChange
          ? {
              new_status: status,
              guest_name: data.guest_name,
              vehicle_name: data.vehicles?.name,
            }
          : {
              edited_fields: {
                vehicle_id: vehicle_id ?? null,
                start_date: start_date ?? null,
                start_time: start_time ?? null,
                end_date: end_date ?? null,
                end_time: end_time ?? null,
              },
              guest_name: data.guest_name,
              vehicle_name: data.vehicles?.name,
            },
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "업데이트에 실패했습니다" },
      { status: 500 }
    );
  }
}

// 예약 삭제 (최고관리자만)
export async function DELETE(request: NextRequest) {
  try {
    const { id, admin_id, admin_role } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }

    // 최고관리자 권한 체크
    if (admin_role !== "super_admin") {
      return NextResponse.json({ error: "최고관리자만 삭제할 수 있습니다" }, { status: 403 });
    }

    // 삭제 대상 정보 조회 (로그용)
    const { data: target } = await supabase
      .from("reservations")
      .select("guest_name, department, start_date, end_date, vehicles(name)")
      .eq("id", id)
      .single();

    // 관리자 이름 조회
    let adminName = "관리자";
    if (admin_id) {
      const { data: adminData } = await supabase
        .from("admins")
        .select("name")
        .eq("id", admin_id)
        .single();
      if (adminData) adminName = adminData.name;
    }

    const { error } = await supabase.from("reservations").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 로그 기록
    if (admin_id) {
      const vehicleName = target?.vehicles
        ? (target.vehicles as { name?: string })?.name
        : undefined;

      writeAdminLog({
        admin_id,
        admin_name: adminName,
        action: "reservation_delete",
        target_type: "reservation",
        target_id: id,
        details: {
          guest_name: target?.guest_name,
          department: target?.department,
          vehicle_name: vehicleName,
          start_date: target?.start_date,
          end_date: target?.end_date,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, admin_note, admin_id } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다" },
        { status: 400 }
      );
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {
      status,
      admin_note: admin_note || null,
    };

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

    const { data, error } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "업데이트에 실패했습니다" },
      { status: 500 }
    );
  }
}

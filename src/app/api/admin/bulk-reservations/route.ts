import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 일괄 예약 등록
export async function POST(request: NextRequest) {
  try {
    const { reservations } = await request.json();

    if (!Array.isArray(reservations) || reservations.length === 0) {
      return NextResponse.json({ error: "예약 데이터가 없습니다" }, { status: 400 });
    }

    // 차량 목록 조회
    const { data: vehicleData } = await supabase.from("vehicles").select("id, name");
    if (!vehicleData || vehicleData.length === 0) {
      return NextResponse.json({ error: "차량 목록 조회 실패" }, { status: 500 });
    }
    const vehicles = vehicleData;

    // 차량명 매칭 함수
    function findVehicle(keyword: string) {
      return vehicles.find((v) => v.name.includes(keyword) || keyword.includes(v.name));
    }

    const results: { success: number; failed: string[] } = { success: 0, failed: [] };

    for (const r of reservations) {
      const vehicle = findVehicle(r.vehicle_keyword);
      if (!vehicle) {
        results.failed.push(`${r.date} ${r.department} - 차량 "${r.vehicle_keyword}" 매칭 실패`);
        continue;
      }

      const { error } = await supabase.from("reservations").insert({
        vehicle_id: vehicle.id,
        guest_name: r.department,
        department: r.department,
        phone: r.phone || "미입력",
        start_date: r.start_date,
        end_date: r.end_date,
        start_time: r.start_time,
        end_time: r.end_time,
        purpose: r.purpose || "",
        destination: r.destination || "",
        status: "approved",
      });

      if (error) {
        results.failed.push(`${r.start_date} ${r.department} - DB 에러: ${error.message}`);
      } else {
        results.success++;
      }
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

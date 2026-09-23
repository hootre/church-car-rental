import type { Metadata } from "next";
import Header from "@/components/Header";
import CalendarView from "@/components/admin/CalendarView";

export const metadata: Metadata = {
  title: "차량 일정 | 한국중앙교회 차량부",
  description: "한국중앙교회 차량부 차량 예약 일정",
};

/**
 * 공개 차량 일정 페이지 (로그인 불필요)
 * 관리자 달력을 읽기 전용(publicMode)으로 재사용합니다.
 */
export default function SchedulePage() {
  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="max-w-2xl md:max-w-4xl mx-auto px-3 md:px-8 pt-5">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-1">차량 일정</h2>
          <p className="text-sm text-gray-500">
            차량별 예약 일정을 확인할 수 있습니다. 날짜를 누르면 해당 날짜의 예약이 표시됩니다
          </p>
        </div>
        <CalendarView publicMode />
      </main>
    </div>
  );
}

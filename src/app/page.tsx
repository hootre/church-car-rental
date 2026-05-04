"use client";

import Link from "next/link";
import Header from "@/components/Header";

export default function HomePage() {
  const churchName = process.env.NEXT_PUBLIC_CHURCH_NAME || "교회";

  return (
    <div className="min-h-screen pb-20">
      <Header />

      <main className="max-w-lg mx-auto px-4 pt-8">
        {/* 히어로 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🚗</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {churchName} 차량 대여
          </h1>
          <p className="text-gray-500 text-sm">
            교회 차량을 간편하게 예약하세요
          </p>
        </div>

        {/* 메뉴 카드 */}
        <div className="space-y-3">
          <Link href="/reserve" className="card flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98]">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">예약 신청</h2>
              <p className="text-sm text-gray-500">차량을 선택하고 예약을 신청합니다</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link href="/check" className="card flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98]">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">예약 조회</h2>
              <p className="text-sm text-gray-500">내 예약 상태를 확인합니다</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link href="/admin" className="card flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98]">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">관리자</h2>
              <p className="text-sm text-gray-500">예약 승인 및 관리</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* 안내사항 */}
        <div className="mt-8 p-4 bg-blue-50 rounded-2xl">
          <h3 className="font-semibold text-primary-800 text-sm mb-2">이용 안내</h3>
          <ul className="text-xs text-primary-700 space-y-1">
            <li>• 예약 신청 후 관리자 승인이 필요합니다</li>
            <li>• 차량 사용 후 원래 주차 위치에 반납해 주세요</li>
            <li>• 사용 중 문제 발생 시 주차부로 연락 바랍니다</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  return (
    <>
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo_dark.png"
              alt="한국중앙교회"
              width={164}
              height={18}
              className="h-5 w-auto object-contain"
            />
            <span className="text-primary-600 font-bold text-lg">차량부</span>
          </Link>

          {/* 데스크탑 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            <DesktopNavItem href="/" label="홈" active={pathname === "/"} />
            <DesktopNavItem href="/reserve" label="예약신청" active={pathname === "/reserve"} />
            <DesktopNavItem href="/check" label="예약조회" active={pathname === "/check"} />
            <DesktopNavItem href="/admin" label="관리자" active={pathname?.startsWith("/admin")} />
          </nav>
        </div>
      </header>

      {/* 모바일 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden">
        <div className="max-w-lg mx-auto flex">
          <MobileNavItem href="/" label="홈" icon={HomeIcon} active={pathname === "/"} />
          <MobileNavItem href="/reserve" label="예약신청" icon={CalendarIcon} active={pathname === "/reserve"} />
          <MobileNavItem href="/check" label="예약조회" icon={SearchIcon} active={pathname === "/check"} />
          <MobileNavItem href="/admin" label="관리자" icon={ShieldIcon} active={pathname?.startsWith("/admin")} />
        </div>
      </nav>
    </>
  );
}

/* 데스크탑 네비 아이템 */
function DesktopNavItem({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-primary-50 text-primary-600"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}

/* 모바일 네비 아이템 */
function MobileNavItem({
  href, label, icon: Icon, active,
}: {
  href: string; label: string; icon: React.FC<{ className?: string }>; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors
        ${active ? "text-primary-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

// 아이콘 컴포넌트들
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

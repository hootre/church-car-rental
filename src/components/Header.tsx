"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Header() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 이미 설치된 상태인지 확인 (standalone 또는 PWA)
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    // iOS Safari 감지
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
    if (isiOS && isSafari) {
      setIsIOS(true);
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  }

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

          <div className="flex items-center gap-1">
            {/* 설치 버튼 (Chrome/Edge 등) */}
            {!isInstalled && installPrompt && (
              <button
                onClick={handleInstall}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors mr-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                설치
              </button>
            )}

            {/* iOS Safari 설치 안내 */}
            {!isInstalled && !installPrompt && isIOS && (
              <div className="relative mr-1">
                <button
                  onClick={() => setShowIOSGuide(!showIOSGuide)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  설치
                </button>
                {showIOSGuide && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-[100]">
                    <button onClick={() => setShowIOSGuide(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="text-sm font-semibold text-gray-900 mb-2">앱 설치 방법</p>
                    <ol className="text-xs text-gray-600 space-y-1.5">
                      <li className="flex items-start gap-1.5">
                        <span className="font-bold text-primary-600 shrink-0">1.</span>
                        <span>하단 Safari 메뉴에서 <span className="inline-block align-text-bottom">
                          <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </span> (공유) 버튼 탭</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-bold text-primary-600 shrink-0">2.</span>
                        <span>&ldquo;홈 화면에 추가&rdquo; 선택</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-bold text-primary-600 shrink-0">3.</span>
                        <span>&ldquo;추가&rdquo; 버튼 탭</span>
                      </li>
                    </ol>
                    <p className="text-[10px] text-gray-400 mt-2">홈 화면에 추가하면 앱처럼 사용할 수 있습니다</p>
                  </div>
                )}
              </div>
            )}

            {/* 데스크탑 네비게이션 */}
            <nav className="hidden md:flex items-center gap-1">
              <DesktopNavItem href="/" label="홈" active={pathname === "/"} />
              <DesktopNavItem href="/reserve" label="예약신청" active={pathname === "/reserve"} />
              <DesktopNavItem href="/check" label="예약조회" active={pathname === "/check"} />
              <DesktopNavItem href="/admin" label="관리자" active={pathname?.startsWith("/admin")} />
            </nav>
          </div>
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

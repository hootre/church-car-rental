"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

/**
 * Service Worker 등록 + 새 버전 자동 적용
 *
 * - 페이지 진입 시 즉시 update 체크
 * - 새 SW 가 설치되면 짧게 토스트 띄우고 자동 새로고침
 *   -> 사용자는 한 번의 새로고침/페이지 이동으로 항상 최신 코드를 보게 됨
 */
export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;

    function triggerReload(reason: string) {
      if (reloading) return;
      reloading = true;
      console.log("[PWA] new SW activated:", reason);
      toast.success("새 버전이 있어 새로고침합니다", { duration: 1200 });
      setTimeout(() => window.location.reload(), 1200);
    }

    function handleRegistration(reg: ServiceWorkerRegistration) {
      // 페이지 진입마다 update 체크 요청
      reg.update().catch(() => {});

      // 이미 대기 중인 새 SW 가 있으면 즉시 활성화 시도
      if (reg.waiting && navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // 새 SW 가 설치 완료됐고, 기존 컨트롤러가 있는 상태(=업데이트 상황)
            triggerReload("updatefound -> installed");
          }
        });
      });
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then(handleRegistration)
      .catch((err) => {
        console.warn("[PWA] SW 등록 실패:", err);
      });

    // 다른 탭에서 SW 가 교체된 경우에도 리로드
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      triggerReload("controllerchange");
    });
  }, []);

  return null;
}

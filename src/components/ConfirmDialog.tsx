"use client";

/**
 * 디자인된 확인 다이얼로그 (브라우저 confirm() 대체)
 *
 * 사용법:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: "예약 삭제",
 *     message: "이 예약을 삭제하시겠습니까?",
 *     confirmText: "삭제",
 *     variant: "danger",
 *   });
 *   if (!ok) return;
 *
 * 사이트 디자인(rounded-2xl, primary-600, danger=red)과 통일.
 */

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // 안전 폴백 — Provider 가 없으면 브라우저 기본 confirm 사용
    return async (opts: ConfirmOptions) => {
      if (typeof window === "undefined") return false;
      return window.confirm(opts.title ? `${opts.title}\n\n${opts.message}` : opts.message);
    };
  }
  return ctx;
}

type DialogState = (ConfirmOptions & { resolve: (v: boolean) => void }) | null;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  function close(value: boolean) {
    if (state) state.resolve(value);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-[fadeIn_.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 본문 */}
            <div className="px-5 py-5">
              {state.title && (
                <h3 className="font-bold text-base text-gray-900 mb-2">
                  {state.title}
                </h3>
              )}
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {state.message}
              </p>
            </div>

            {/* 버튼 */}
            <div className="border-t border-gray-100 flex">
              <button
                type="button"
                onClick={() => close(false)}
                className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {state.cancelText || "취소"}
              </button>
              <div className="w-px bg-gray-100" />
              <button
                type="button"
                onClick={() => close(true)}
                autoFocus
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  state.variant === "danger"
                    ? "text-red-600 hover:bg-red-50 active:bg-red-100"
                    : "text-primary-600 hover:bg-primary-50 active:bg-primary-100"
                }`}
              >
                {state.confirmText || "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

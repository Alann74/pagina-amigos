"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";
import { useHydrated } from "@/lib/use-hydrated";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right" | "top";
  title: string;
  hideTitle?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  testId?: string;
};

/** Panel lateral accesible: foco atrapado, Escape para cerrar, scroll del body bloqueado. */
export function Drawer({ open, onClose, side = "right", title, hideTitle, children, footer, widthClass = "max-w-[440px]", testId }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
    const t = window.setTimeout(() => {
      const list = focusables();
      (list && list.length > 1 ? list[1] : list?.[0])?.focus({ preventScroll: true });
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = focusables();
        if (!list || list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      window.scrollTo({ top: scrollY });
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!hydrated || !open) return null;

  const position =
    side === "right"
      ? `right-0 top-0 h-full w-full ${widthClass} animate-slide-in-right`
      : side === "left"
        ? `left-0 top-0 h-full w-full ${widthClass} animate-slide-in-left`
        : "left-0 top-0 w-full max-h-dvh animate-slide-up";

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid={testId}>
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full animate-fade-in cursor-default bg-ink/30"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute flex flex-col bg-paper ${position}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className={`flex h-13 shrink-0 items-center justify-between px-5 sm:h-16 ${hideTitle ? "" : "border-b border-line"}`}>
          <h2 className={`nav-link font-medium ${hideTitle ? "sr-only" : ""}`}>{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? <div className="shrink-0 border-t border-line">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

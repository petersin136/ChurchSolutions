"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AuthBrand } from "./AuthBrand";
import styles from "./authCardLayout.module.css";

export function AuthCardShell({
  children,
  footer,
  styleTag,
  scrollButtons = false,
  lockBodyScroll = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  styleTag?: ReactNode;
  /** 스크롤바 숨김 + 상·하단 스크롤 버튼 (교회 찾기 등 콘텐츠 많은 화면) */
  scrollButtons?: boolean;
  /** 카드 본문 스크롤 비활성 — 자식이 내부 영역만 스크롤할 때 */
  lockBodyScroll?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setCanScrollUp(scrollTop > 2);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  useEffect(() => {
    if (!scrollButtons) return;
    const el = scrollRef.current;
    if (!el) return;

    updateScrollEdges();
    el.addEventListener("scroll", updateScrollEdges, { passive: true });
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollEdges);
      observer.disconnect();
    };
  }, [scrollButtons, updateScrollEdges, children]);

  const scrollBy = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ top: direction * 140, behavior: "smooth" });
  };

  const scrollClass = [
    styles.cardBodyScroll,
    scrollButtons ? styles.cardBodyScrollHidden : "",
    lockBodyScroll ? styles.cardBodyScrollLocked : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.page}>
      {styleTag}
      <div className={styles.card}>
        <AuthBrand />
        <div className={styles.cardBody}>
          {scrollButtons && canScrollUp ? (
            <button
              type="button"
              className={styles.scrollBtn}
              onClick={() => scrollBy(-1)}
              aria-label="위로 스크롤"
            >
              <ChevronUp size={18} strokeWidth={2} />
            </button>
          ) : null}
          <div ref={scrollRef} className={scrollClass}>
            {children}
          </div>
          {scrollButtons && canScrollDown ? (
            <button
              type="button"
              className={styles.scrollBtn}
              onClick={() => scrollBy(1)}
              aria-label="아래로 스크롤"
            >
              <ChevronDown size={18} strokeWidth={2} />
            </button>
          ) : null}
          {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function AuthPageLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.loadingText}>로딩 중...</div>
    </div>
  );
}

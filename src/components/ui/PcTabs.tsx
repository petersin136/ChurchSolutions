"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./PcTabs.module.css";

export interface PcTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: "underline" | "pill" | "boxed";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: ReactNode;
}

type PcTabsVariant = NonNullable<PcTabsProps["variant"]>;
type PcTabsSize = NonNullable<PcTabsProps["size"]>;

type PcTabsContextValue = {
  value: string;
  onValueChange: (v: string) => void;
  variant: PcTabsVariant;
  size: PcTabsSize;
  fullWidth: boolean;
  baseId: string;
};

const PcTabsContext = createContext<PcTabsContextValue | null>(null);

function usePcTabsContext(component: string): PcTabsContextValue {
  const ctx = useContext(PcTabsContext);
  if (!ctx) {
    throw new Error(`${component} must be used inside PcTabs`);
  }
  return ctx;
}

function sanitizeId(raw: string): string {
  return raw.replace(/:/g, "");
}

function PcTabsRoot({
  value,
  onValueChange,
  variant = "underline",
  size = "md",
  fullWidth = false,
  children,
}: PcTabsProps) {
  const reactId = useId();
  const baseId = useMemo(() => sanitizeId(reactId), [reactId]);
  const ctx = useMemo(
    () => ({
      value,
      onValueChange,
      variant,
      size,
      fullWidth,
      baseId,
    }),
    [value, onValueChange, variant, size, fullWidth, baseId],
  );

  return (
    <PcTabsContext.Provider value={ctx}>
      <div className={styles.root}>{children}</div>
    </PcTabsContext.Provider>
  );
}

export interface PcTabsListProps {
  children: ReactNode;
  ariaLabel?: string;
}

function PcTabsList({ children, ariaLabel }: PcTabsListProps) {
  const ctx = usePcTabsContext("PcTabs.List");
  const { variant, fullWidth } = ctx;
  const listRef = useRef<HTMLDivElement>(null);

  const listClass = [
    styles.list,
    variant === "underline" && styles.listUnderline,
    variant === "pill" && styles.listPill,
    variant === "boxed" && styles.listBoxed,
    fullWidth && styles.listFullWidth,
  ]
    .filter(Boolean)
    .join(" ");

  const getEnabledTabs = useCallback((): HTMLButtonElement[] => {
    const root = listRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    ).filter((el) => !el.disabled);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = getEnabledTabs();
    if (tabs.length === 0) return;

    if (e.key === "Enter" || e.key === " ") {
      const focused = document.activeElement as HTMLButtonElement | null;
      if (
        focused &&
        focused.matches('button[role="tab"]') &&
        listRef.current?.contains(focused) &&
        !focused.disabled
      ) {
        e.preventDefault();
        const v = focused.getAttribute("data-tab-value");
        if (v) ctx.onValueChange(v);
      }
      return;
    }

    const { activeElement } = document;
    let idx = tabs.indexOf(activeElement as HTMLButtonElement);
    if (idx < 0) idx = tabs.findIndex((t) => t.getAttribute("data-state") === "active");
    if (idx < 0) idx = 0;

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      let next = idx;
      for (let step = 0; step < tabs.length; step++) {
        next = (next + delta + tabs.length) % tabs.length;
        if (!tabs[next]!.disabled) break;
      }
      tabs[next]?.focus();
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      tabs[0]?.focus();
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      tabs[tabs.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={listClass}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export interface PcTabsTriggerProps {
  value: string;
  disabled?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}

function PcTabsTrigger({
  value: tabValue,
  disabled = false,
  icon,
  badge,
  children,
}: PcTabsTriggerProps) {
  const ctx = usePcTabsContext("PcTabs.Trigger");
  const id = `${ctx.baseId}-tab-${tabValue}`;
  const panelId = `${ctx.baseId}-panel-${tabValue}`;
  const selected = ctx.value === tabValue;

  const sizePad =
    ctx.variant === "pill"
      ? ctx.size === "sm"
        ? styles.triggerPillSm
        : ctx.size === "lg"
          ? styles.triggerPillLg
          : styles.triggerPillMd
      : ctx.size === "sm"
        ? styles.triggerSm
        : ctx.size === "lg"
          ? styles.triggerLg
          : styles.triggerMd;

  const variantClass =
    ctx.variant === "pill"
      ? styles.triggerPill
      : ctx.variant === "boxed"
        ? styles.triggerBoxed
        : styles.triggerUnderline;

  const iconClass =
    ctx.size === "sm" ? styles.iconSm : ctx.size === "lg" ? styles.iconLg : styles.iconMd;

  const triggerClass = [
    styles.trigger,
    sizePad,
    variantClass,
    disabled ? styles.triggerDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      id={id}
      role="tab"
      className={triggerClass}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      data-state={selected ? "active" : "inactive"}
      data-tab-value={tabValue}
      disabled={disabled}
      onClick={() => {
        if (!disabled) ctx.onValueChange(tabValue);
      }}
    >
      {icon ? <span className={iconClass}>{icon}</span> : null}
      <span>{children}</span>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
    </button>
  );
}

export interface PcTabsContentProps {
  value: string;
  children: ReactNode;
  forceMount?: boolean;
  keepMounted?: boolean;
}

function PcTabsContent({
  value: tabValue,
  children,
  forceMount = false,
  keepMounted = false,
}: PcTabsContentProps) {
  const ctx = usePcTabsContext("PcTabs.Content");
  const panelId = `${ctx.baseId}-panel-${tabValue}`;
  const tabId = `${ctx.baseId}-tab-${tabValue}`;
  const selected = ctx.value === tabValue;
  const persist = keepMounted || forceMount;

  if (!selected && !persist) {
    return null;
  }

  const panelClass =
    !selected && persist
      ? `${styles.panel} ${styles.panelHidden}`
      : styles.panel;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={selected ? 0 : -1}
      className={panelClass}
    >
      {children}
    </div>
  );
}

export const PcTabs = Object.assign(PcTabsRoot, {
  List: PcTabsList,
  Trigger: PcTabsTrigger,
  Content: PcTabsContent,
});

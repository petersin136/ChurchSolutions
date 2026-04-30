"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "./PcSelect.module.css";

export type PcSelectSize = "sm" | "md" | "lg";

export interface PcSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface PcSelectProps {
  /** @example <PcSelect value={v} onChange={setV} options={[{ value: "1", label: "하나" }]} /> */
  value: string;
  onChange: (value: string) => void;
  options: PcSelectOption[];
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  size?: PcSelectSize;
  disabled?: boolean;
  searchable?: boolean;
  fullWidth?: boolean;
  id?: string;
}

const sizeClass: Record<PcSelectSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function PcSelect({
  value,
  onChange,
  options,
  placeholder = "선택하세요",
  label,
  helperText,
  error,
  size = "md",
  disabled = false,
  searchable = false,
  fullWidth = false,
  id: idProp,
}: PcSelectProps) {
  const uid = useId();
  const baseId = idProp ?? `pc-select-${uid}`;
  const listboxId = `${baseId}-listbox`;
  const triggerId = `${baseId}-trigger`;
  const searchId = `${baseId}-search`;
  const helpId = `${baseId}-help`;
  const errId = `${baseId}-err`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = normalize(query);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query, searchable]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const describedBy = error ? errId : helperText ? helpId : undefined;

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        const len = filteredOptions.length;
        if (len === 0) return 0;
        let i = prev;
        for (let step = 0; step < len + 1; step++) {
          i = (i + delta + len) % len;
          if (!filteredOptions[i]?.disabled) return i;
        }
        return prev;
      });
    },
    [filteredOptions],
  );

  const selectIndex = useCallback(
    (idx: number) => {
      const opt = filteredOptions[idx];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    },
    [filteredOptions, onChange],
  );

  useEffect(() => {
    if (!open) return;
    const idx = filteredOptions.findIndex((o) => o.value === value);
    let start = idx >= 0 ? idx : 0;
    if (filteredOptions[start]?.disabled) {
      const first = filteredOptions.findIndex((o) => !o.disabled);
      start = first >= 0 ? first : 0;
    }
    setActiveIndex(start);
  }, [open, value, filteredOptions]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "Tab" && open) {
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (open) {
        e.preventDefault();
        selectIndex(activeIndex);
      } else {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (open && e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (open && e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (open && e.key === "Home") {
      e.preventDefault();
      const first = filteredOptions.findIndex((o) => !o.disabled);
      if (first >= 0) setActiveIndex(first);
      return;
    }
    if (open && e.key === "End") {
      e.preventDefault();
      let last = -1;
      for (let i = filteredOptions.length - 1; i >= 0; i--) {
        if (!filteredOptions[i]?.disabled) {
          last = i;
          break;
        }
      }
      if (last >= 0) setActiveIndex(last);
    }
  };

  const activeOptionId =
    open && filteredOptions.length > 0
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  return (
    <div
      ref={rootRef}
      className={[
        styles.wrap,
        fullWidth ? styles.wrapFullWidth : "",
        disabled ? styles.disabled : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label ? (
        <label htmlFor={triggerId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div
        className={[
          styles.field,
          sizeClass[size],
          error ? styles.fieldError : "",
          open ? styles.fieldOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={styles.trigger}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          role="combobox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            if (!open) setQuery("");
          }}
          onKeyDown={onTriggerKeyDown}
        >
          <span
            className={[
              styles.triggerText,
              !selectedLabel ? styles.placeholder : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {selectedLabel ?? placeholder}
          </span>
          <span className={styles.chevronWrap} aria-hidden>
            <ChevronDown
              className={[styles.chevron, open ? styles.chevronOpen : ""]
                .filter(Boolean)
                .join(" ")}
            />
          </span>
        </button>
      </div>
      {open && !disabled ? (
        <div className={styles.dropdown}>
          {searchable ? (
            <div className={styles.searchWrap}>
              <input
                id={searchId}
                type="search"
                className={styles.searchInput}
                tabIndex={-1}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="옵션 검색"
              />
            </div>
          ) : null}
          <ul
            id={listboxId}
            role="listbox"
            className={styles.list}
            aria-labelledby={label ? triggerId : undefined}
          >
            {filteredOptions.map((opt, idx) => {
              const selected = opt.value === value;
              const active = idx === activeIndex;
              const oid = `${listboxId}-opt-${idx}`;
              return (
                <li
                  key={opt.value}
                  id={oid}
                  role="option"
                  aria-selected={selected}
                  className={[
                    styles.option,
                    active ? styles.optionActive : "",
                    selected ? styles.optionSelected : "",
                    opt.disabled ? styles.optionDisabled : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => {
                    if (!opt.disabled) setActiveIndex(idx);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (opt.disabled) return;
                    selectIndex(idx);
                  }}
                >
                  <span>{opt.label}</span>
                  {selected ? <Check className={styles.check} aria-hidden strokeWidth={2} /> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p id={errId} className={styles.error} role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={helpId} className={styles.helper}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MEMBER_MGMT } from "@/styles/memberManagementTokens";

export interface MemberSearchComboProps {
  value: string;
  onChange: (value: string) => void;
  deptOptions: { value: string; label: string }[];
  mokjangOptions: { value: string; label: string }[];
  roleOptions: { value: string; label: string }[];
  onSelectDept: (value: string) => void;
  onSelectMokjang: (value: string) => void;
  onSelectRole: (value: string) => void;
  placeholder?: string;
}

export function MemberSearchCombo({
  value,
  onChange,
  deptOptions,
  mokjangOptions,
  roleOptions,
  onSelectDept,
  onSelectMokjang,
  onSelectRole,
  placeholder = "이름, 부서, 목장, 직분 검색 또는 선택...",
}: MemberSearchComboProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(
    () => [
      { title: "부서", options: deptOptions.filter((o) => o.value !== "all"), onSelect: onSelectDept },
      { title: "목장", options: mokjangOptions.filter((o) => o.value !== "all"), onSelect: onSelectMokjang },
      { title: "직분", options: roleOptions.filter((o) => o.value !== "all"), onSelect: onSelectRole },
    ],
    [deptOptions, mokjangOptions, roleOptions, onSelectDept, onSelectMokjang, onSelectRole],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: MEMBER_MGMT.searchHeight,
          borderRadius: MEMBER_MGMT.searchRadius,
          border: `1px solid ${MEMBER_MGMT.searchBorder}`,
          background: MEMBER_MGMT.searchBg,
          overflow: "hidden",
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            outline: "none",
            padding: `0 ${MEMBER_MGMT.searchPadX}px`,
            fontFamily: MEMBER_MGMT.fontKR,
            fontSize: MEMBER_MGMT.searchFontSize,
            color: MEMBER_MGMT.searchText,
            background: "transparent",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          aria-label="부서·목장·직분 선택"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: "100%",
            border: "none",
            borderLeft: `1px solid ${MEMBER_MGMT.searchBorder}`,
            background: "transparent",
            color: MEMBER_MGMT.searchPlaceholder,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ChevronDown size={18} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
        </button>
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 40,
            maxHeight: 320,
            overflowY: "auto",
            background: MEMBER_MGMT.dropdownBg,
            border: `1px solid ${MEMBER_MGMT.dropdownBorder}`,
            borderRadius: MEMBER_MGMT.dropdownRadius,
            boxShadow: MEMBER_MGMT.dropdownShadow,
            padding: "8px 0",
          }}
        >
          {sections.map((section) =>
            section.options.length === 0 ? null : (
              <div key={section.title}>
                <div
                  style={{
                    padding: "6px 14px 4px",
                    fontSize: MEMBER_MGMT.dropdownSectionFontSize,
                    fontWeight: 700,
                    color: MEMBER_MGMT.dropdownSectionLabel,
                    letterSpacing: "0.02em",
                  }}
                >
                  {section.title}
                </div>
                {section.options.map((opt) => (
                  <button
                    key={`${section.title}-${opt.value}`}
                    type="button"
                    onClick={() => {
                      section.onSelect(opt.value);
                      onChange(opt.label);
                      setOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      padding: MEMBER_MGMT.dropdownItemPad,
                      fontFamily: MEMBER_MGMT.fontKR,
                      fontSize: MEMBER_MGMT.searchFontSize,
                      color: MEMBER_MGMT.searchText,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = MEMBER_MGMT.dropdownItemHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

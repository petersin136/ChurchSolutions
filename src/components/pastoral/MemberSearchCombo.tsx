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
  /** 이름 검색 자동완성 (출석부 등 — 테이블은 유지하고 드롭다운만 표시) */
  memberMatches?: { id: string; name: string; subtitle?: string }[];
  onSelectMember?: (memberId: string) => void;
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
  memberMatches,
  onSelectMember,
}: MemberSearchComboProps) {
  const [open, setOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const showMemberDropdown =
    Boolean(onSelectMember) && inputFocused && value.trim().length > 0;
  const dropdownOpen = open || showMemberDropdown;

  const sections = useMemo(
    () => [
      { title: "부서", options: deptOptions.filter((o) => o.value !== "all"), onSelect: onSelectDept },
      { title: "목장", options: mokjangOptions.filter((o) => o.value !== "all"), onSelect: onSelectMokjang },
      { title: "직분", options: roleOptions.filter((o) => o.value !== "all"), onSelect: onSelectRole },
    ],
    [deptOptions, mokjangOptions, roleOptions, onSelectDept, onSelectMokjang, onSelectRole],
  );

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setInputFocused(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [dropdownOpen]);

  return (
    <div ref={rootRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: MEMBER_MGMT.searchHeight,
          borderRadius: MEMBER_MGMT.radius,
          border: `1px solid ${MEMBER_MGMT.searchBorder}`,
          background: MEMBER_MGMT.searchBg,
          overflow: "hidden",
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setInputFocused(false);
            }
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
            lineHeight: MEMBER_MGMT.searchLineHeight,
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
            width: 40,
            height: "100%",
            border: "none",
            background: "transparent",
            color: MEMBER_MGMT.searchPlaceholder,
            cursor: "pointer",
            flexShrink: 0,
            padding: "0 12px 0 4px",
          }}
        >
          <ChevronDown size={18} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
        </button>
      </div>
      {dropdownOpen && (
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
            borderRadius: MEMBER_MGMT.radius,
            boxShadow: MEMBER_MGMT.dropdownShadow,
            padding: "8px 0",
          }}
        >
          {showMemberDropdown && (
            <div>
              <div
                style={{
                  padding: "6px 14px 4px",
                  fontSize: MEMBER_MGMT.dropdownSectionFontSize,
                  fontWeight: 700,
                  color: MEMBER_MGMT.dropdownSectionLabel,
                  letterSpacing: "0.02em",
                }}
              >
                성도
              </div>
              {(memberMatches ?? []).length === 0 ? (
                <div
                  style={{
                    padding: MEMBER_MGMT.dropdownItemPad,
                    fontFamily: MEMBER_MGMT.fontKR,
                    fontSize: MEMBER_MGMT.searchFontSize,
                    color: MEMBER_MGMT.searchPlaceholder,
                  }}
                >
                  검색 결과가 없습니다
                </div>
              ) : (
                (memberMatches ?? []).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelectMember?.(m.id);
                      setOpen(false);
                      setInputFocused(false);
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
                    <div>{m.name}</div>
                    {m.subtitle ? (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: MEMBER_MGMT.dropdownSectionFontSize,
                          color: MEMBER_MGMT.searchPlaceholder,
                          fontWeight: 500,
                        }}
                      >
                        {m.subtitle}
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
          {open &&
            sections.map((section) =>
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

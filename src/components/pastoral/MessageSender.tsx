"use client";

import { useState, useMemo, useEffect } from "react";
import type { DB } from "@/types/db";
import { Copy, MessageCircle, Search, CheckSquare, Square } from "lucide-react";

interface MessageSenderProps {
  db: DB;
  toast: (msg: string, type?: string) => void;
}

const TEMPLATES: { label: string; body: string }[] = [
  { label: "생일 축하", body: "OO님의 생일을 축하합니다! 하나님의 은혜와 축복이 넘치는 한 해가 되시길 기도합니다." },
  { label: "심방 안내", body: "OO님 안녕하세요. 이번 주 심방 일정을 안내드립니다." },
  { label: "예배 안내", body: "이번 주일 예배에 함께해 주세요. 하나님의 은혜가 충만하시길 바랍니다." },
  { label: "격려", body: "OO님, 오늘도 하나님의 은혜 안에서 평안하시길 기도합니다." },
  { label: "자유 입력", body: "" },
];

function useIsMobile() {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const c = () => setMob(window.innerWidth <= 768);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, []);
  return mob;
}

export function MessageSender({ db, toast }: MessageSenderProps) {
  const isMobile = useIsMobile();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return db.members;
    const q = search.trim().toLowerCase();
    return db.members.filter((m) => m.name.toLowerCase().includes(q));
  }, [db.members, search]);

  const firstSelectedName = useMemo(() => {
    if (selectedIds.size === 0) return "";
    const first = db.members.find((m) => selectedIds.has(m.id));
    return first?.name ?? "";
  }, [db.members, selectedIds]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((m) => m.id)));
  const clearAll = () => setSelectedIds(new Set());

  const applyTemplate = (idx: number) => {
    setActiveTemplate(idx);
    const tpl = TEMPLATES[idx];
    if (!tpl.body) {
      setContent("");
      return;
    }
    const name = firstSelectedName || "OO";
    setContent(tpl.body.replace(/OO/g, name));
  };

  const copyToClipboard = async () => {
    if (!content.trim()) {
      toast("메시지를 입력해 주세요.", "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      toast("클립보드에 복사되었습니다.", "ok");
    } catch {
      toast("복사에 실패했습니다.", "err");
    }
  };

  const sendKakao = async () => {
    if (!content.trim()) {
      toast("메시지를 입력해 주세요.", "warn");
      return;
    }
    const encoded = encodeURIComponent(content);
    if (isMobile) {
      window.location.href = `kakaotalk://send?text=${encoded}`;
    } else {
      try {
        await navigator.clipboard.writeText(content);
        toast("클립보드에 복사되었습니다. 카카오톡에 붙여넣기 해주세요.", "ok");
      } catch {
        toast("복사에 실패했습니다.", "err");
      }
    }
  };

  const card: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #f3f4f6",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Member Selection */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1b2a4a" }}>수신자 선택</h3>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              fontWeight: 600,
              color: selectedIds.size > 0 ? "#4361ee" : "#6b7b9e",
              background: selectedIds.size > 0 ? "#eef0ff" : "#f3f4f6",
              padding: "4px 12px",
              borderRadius: 20,
            }}
          >
            {selectedIds.size}명 선택
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="search"
              placeholder="이름 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px 9px 32px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button type="button" onClick={selectAll} style={btnOutline}>
            전체 선택
          </button>
          <button type="button" onClick={clearAll} style={btnOutline}>
            선택 해제
          </button>
        </div>

        <div
          style={{
            maxHeight: 260,
            overflowY: "auto",
            border: "1px solid #f3f4f6",
            borderRadius: 12,
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>검색 결과가 없습니다.</div>
          )}
          {filtered.map((m) => {
            const checked = selectedIds.has(m.id);
            return (
              <div
                key={m.id}
                onClick={() => toggle(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f9fafb",
                  transition: "background 0.15s",
                  background: checked ? "#f0f4ff" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!checked) e.currentTarget.style.background = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = checked ? "#f0f4ff" : "transparent";
                }}
              >
                {checked ? (
                  <CheckSquare size={18} style={{ color: "#4361ee", flexShrink: 0 }} />
                ) : (
                  <Square size={18} style={{ color: "#d1d5db", flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 14, fontWeight: 500, color: "#1b2a4a" }}>{m.name}</span>
                {m.dept && <span style={{ fontSize: 12, color: "#9ca3af" }}>{m.dept}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Compose */}
      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#1b2a4a" }}>메시지 작성</h3>

        {/* Templates */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {TEMPLATES.map((tpl, i) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(i)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: activeTemplate === i ? "1.5px solid #4361ee" : "1px solid #e5e7eb",
                background: activeTemplate === i ? "#eef0ff" : "#ffffff",
                color: activeTemplate === i ? "#4361ee" : "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tpl.label}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setActiveTemplate(null);
          }}
          placeholder="메시지를 입력하세요..."
          style={{
            width: "100%",
            minHeight: 140,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontSize: 14,
            lineHeight: 1.6,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" onClick={copyToClipboard} style={btnCopy}>
            <Copy size={16} />
            클립보드 복사
          </button>
          <button type="button" onClick={sendKakao} style={btnKakao}>
            <MessageCircle size={16} />
            카카오톡으로 보내기
          </button>
        </div>
      </div>
    </div>
  );
}

const btnOutline: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnCopy: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 20px",
  borderRadius: 12,
  border: "none",
  background: "#3b82f6",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const btnKakao: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 20px",
  borderRadius: 12,
  border: "none",
  background: "#FEE500",
  color: "#191919",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

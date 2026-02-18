"use client";

import type { Member } from "@/types/db";
import { registerKoreanFont } from "@/utils/fontLoader";

const DEFAULT_COLUMNS: { key: keyof Member | "member_status"; label: string }[] = [
  { key: "name", label: "이름" },
  { key: "dept", label: "부서" },
  { key: "role", label: "직분" },
  { key: "phone", label: "연락처" },
  { key: "address", label: "주소" },
  { key: "member_status", label: "상태" },
];

function getMemberValue(m: Member, key: string): string {
  if (key === "member_status") return (m.member_status ?? m.status ?? "") as string;
  const v = (m as unknown as Record<string, unknown>)[key];
  return v != null ? String(v) : "";
}

export async function generateCustomReportPdf(
  members: Member[],
  columns: { key: string; label: string }[] = DEFAULT_COLUMNS
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerKoreanFont(doc);
  doc.setFont("NanumGothic", "normal");

  let y = 18;
  doc.setFontSize(12);
  doc.text(`교인 목록 (${members.length}명)`, 14, y);
  y += 10;

  doc.setFontSize(8);
  const colW = 270 / columns.length;
  const headers = columns.map((c) => c.label);
  headers.forEach((h, i) => {
    doc.setFont("NanumGothic", "bold");
    doc.text(h, 14 + i * colW, y);
  });
  y += 6;
  doc.setFont("NanumGothic", "normal");

  members.slice(0, 50).forEach((m) => {
    columns.forEach((col, i) => {
      const val = getMemberValue(m, col.key);
      doc.text(val.length > 12 ? val.slice(0, 12) + "…" : val, 14 + i * colW, y);
    });
    y += 5;
  });

  if (members.length > 50) {
    y += 4;
    doc.setFontSize(8);
    doc.text(`(상위 50명만 표시. 전체 ${members.length}명)`, 14, y);
  }

  doc.save(`교인목록_${new Date().toISOString().slice(0, 10)}.pdf`);
}

"use client";

import type { Member } from "@/types/db";
import { registerKoreanFont } from "@/utils/fontLoader";

export async function generateChurchRegisterPdf(
  member: Member,
  churchName: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerKoreanFont(doc);
  doc.setFont("NanumGothic", "normal");

  let y = 20;
  doc.setFontSize(16);
  doc.text("교 적 부", 105, y, { align: "center" });
  y += 12;
  doc.setFontSize(11);
  doc.text(`${churchName || "교회"}`, 105, y, { align: "center" });
  y += 14;

  doc.setFontSize(10);
  const rows: [string, string][] = [
    ["성명", member.name ?? "-"],
    ["부서", member.dept ?? "-"],
    ["직분", member.role ?? "-"],
    ["생년월일", member.birth ?? "-"],
    ["성별", member.gender ?? "-"],
    ["연락처", member.phone ?? "-"],
    ["주소", (member.address ?? "-").slice(0, 50)],
    ["세례일", member.baptism_date ?? "-"],
    ["세례 유형", member.baptism_type ?? "-"],
    ["등록일", member.registered_date ?? "-"],
    ["비고", (member.memo ?? "-").slice(0, 60)],
  ];
  rows.forEach(([label, value]) => {
    doc.setFont("NanumGothic", "bold");
    doc.text(label, 20, y);
    doc.setFont("NanumGothic", "normal");
    doc.text(value, 50, y);
    y += 7;
  });

  doc.save(`교적부_${(member.name ?? "성도").replace(/\s/g, "_")}.pdf`);
}

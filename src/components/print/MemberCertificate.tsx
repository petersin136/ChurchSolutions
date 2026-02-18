"use client";

import type { Member } from "@/types/db";
import { registerKoreanFont } from "@/utils/fontLoader";

export async function generateMemberCertificatePdf(
  member: Member,
  churchName: string,
  sealImageUrl?: string | null
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerKoreanFont(doc);
  doc.setFont("NanumGothic", "normal");

  let y = 30;
  doc.setFontSize(18);
  doc.text("교 인 증 명 서", 105, y, { align: "center" });
  y += 16;
  doc.setFontSize(11);
  doc.text(`${churchName || "교회"}`, 105, y, { align: "center" });
  y += 20;

  doc.setFontSize(10);
  doc.text("위 사람은 본 교회 등록 교인임을 증명합니다.", 105, y, { align: "center" });
  y += 14;

  const rows: [string, string][] = [
    ["성명", member.name ?? "-"],
    ["부서", member.dept ?? "-"],
    ["직분", member.role ?? "-"],
    ["연락처", member.phone ?? "-"],
  ];
  rows.forEach(([label, value]) => {
    doc.setFont("NanumGothic", "bold");
    doc.text(label, 60, y);
    doc.setFont("NanumGothic", "normal");
    doc.text(value, 90, y);
    y += 8;
  });
  y += 10;

  if (sealImageUrl) {
    try {
      const imgW = 24;
      const imgH = 24;
      doc.addImage(sealImageUrl, "PNG", 105 - imgW / 2, y - 6, imgW, imgH);
    } catch {
      doc.setFont("NanumGothic", "normal");
      doc.setFontSize(8);
      doc.text("(직인)", 105, y + 4, { align: "center" });
    }
  } else {
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(8);
    doc.text("(직인)", 105, y + 4, { align: "center" });
  }

  doc.save(`교인증명서_${(member.name ?? "성도").replace(/\s/g, "_")}.pdf`);
}

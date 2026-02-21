"use client";

import type { Member } from "@/types/db";
import { registerKoreanFont } from "@/utils/fontLoader";

/** 교단명에 '침례'가 포함되면 '침례' 표기 (예: 침례교, 기독교한국침례회) */
function isBaptistDenomination(denomination?: string | null): boolean {
  const d = denomination?.trim();
  return Boolean(d && d.includes("침례"));
}

export async function generateBaptismCertificatePdf(
  member: Member,
  churchName: string,
  sealImageUrl?: string | null,
  denomination?: string | null
): Promise<void> {
  const useChimrye = isBaptistDenomination(denomination);
  const title = useChimrye ? "침 례 증 명 서" : "세 례 증 명 서";
  const defaultType = useChimrye ? "침례" : "세례";
  const dateLabel = useChimrye ? "침례일" : "세례일";
  const fileNamePrefix = useChimrye ? "침례증명서" : "세례증명서";

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerKoreanFont(doc);
  doc.setFont("NanumGothic", "normal");

  let y = 30;
  doc.setFontSize(18);
  doc.text(title, 105, y, { align: "center" });
  y += 16;
  doc.setFontSize(11);
  doc.text(`${churchName || "교회"}`, 105, y, { align: "center" });
  y += 20;

  doc.setFontSize(10);
  doc.text(`위 사람은 본 교회에서 ${member.baptism_type ?? defaultType}를 받았음을 증명합니다.`, 105, y, { align: "center" });
  y += 10;
  doc.text(`${dateLabel}: ${member.baptism_date ?? "-"}`, 105, y, { align: "center" });
  y += 18;

  doc.setFont("NanumGothic", "bold");
  doc.text(member.name ?? "-", 105, y, { align: "center" });
  y += 25;

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

  doc.save(`${fileNamePrefix}_${(member.name ?? "성도").replace(/\s/g, "_")}.pdf`);
}

"use client";

import type { Member } from "@/types/db";
import type { Settings } from "@/types/db";
import { registerKoreanFont } from "@/utils/fontLoader";
import { displayBaptismType, getBaptismTermLabels } from "@/lib/churchTerminology";

export async function generateBaptismCertificatePdf(
  member: Member,
  churchName: string,
  sealImageUrl?: string | null,
  settings?: Pick<Settings, "baptismTerminology" | "denomination"> | null,
): Promise<void> {
  const labels = getBaptismTermLabels(settings ?? {});
  const title = labels.baptismCertificateTitle;
  const defaultType = labels.baptism;
  const dateLabel = labels.baptismDate;
  const fileNamePrefix = labels.baptismCertificate;

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
  const displayType = displayBaptismType(member.baptism_type, settings ?? {}) || defaultType;
  doc.text(`위 사람은 본 교회에서 ${displayType}를 받았음을 증명합니다.`, 105, y, { align: "center" });
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

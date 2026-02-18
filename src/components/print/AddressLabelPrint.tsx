"use client";

import type { Member } from "@/types/db";
import { registerKoreanFont } from "@/utils/fontLoader";

/** 3열 x 8행 라벨지 (A4 기준 약 70x37mm per label) */
const COLS = 3;
const ROWS = 8;
const LABEL_W = 70;
const LABEL_H = 37;
const MARGIN_X = 5;
const MARGIN_Y = 10;
const GAP_X = 2;
const GAP_Y = 2;

export async function generateAddressLabelPdf(members: Member[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerKoreanFont(doc);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(9);

  let idx = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const m = members[idx];
      const x = MARGIN_X + col * (LABEL_W + GAP_X);
      const y = MARGIN_Y + row * (LABEL_H + GAP_Y);
      if (m) {
        const name = (m.name ?? "-").trim();
        const addr = (m.address ?? "").trim();
        const line1 = name ? `${name} (${m.dept ?? ""})` : "-";
        doc.text(line1, x + 3, y + 6);
        if (addr) doc.text(addr.length > 28 ? addr.slice(0, 28) + "…" : addr, x + 3, y + 14);
      }
      idx++;
      if (idx >= members.length) break;
    }
    if (idx >= members.length) break;
  }

  doc.save(`주소라벨_${new Date().toISOString().slice(0, 10)}.pdf`);
}

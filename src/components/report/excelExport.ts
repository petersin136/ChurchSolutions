import type { ColumnDef } from "./ReportModal";

export async function downloadExcel(
  title: string,
  columns: ColumnDef[],
  data: Record<string, unknown>[],
  filename: string,
) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));

  ws.columns = columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: col.excelWidth || 15,
  }));

  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  for (const row of data) {
    const vals: Record<string, unknown> = {};
    for (const col of columns) vals[col.key] = row[col.key] ?? "";
    ws.addRow(vals);
  }

  const borderStyle = {
    top: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
    left: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
    right: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  };

  for (let r = 2; r <= data.length + 1; r++) {
    const row = ws.getRow(r);
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 11 };
      const colDef = columns[colNumber - 1];
      cell.alignment = {
        horizontal: colDef?.align || "left",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = borderStyle;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

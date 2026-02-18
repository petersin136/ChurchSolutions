"use client";

import React from "react";

const FOOTER_TEXT = "본 보고서는 ChurchSolutions에서 자동 생성되었습니다.";

export interface ReportLayoutProps {
  title: string;
  period?: string;
  churchName?: string;
  logoUrl?: string | null;
  children: React.ReactNode;
  onPdfDownload?: () => Promise<void>;
  onPrint?: () => void;
  onExcel?: () => void;
  className?: string;
}

export function ReportLayout({
  title,
  period,
  churchName,
  logoUrl,
  children,
  onPdfDownload,
  onPrint,
  onExcel,
  className = "",
}: ReportLayoutProps) {
  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .report-a4 { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className={`space-y-4 ${className}`}>
        <div className="no-print flex flex-wrap items-center gap-2">
          {onPdfDownload && (
            <button
              type="button"
              onClick={onPdfDownload}
              className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:opacity-90"
            >
              PDF 다운로드
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            인쇄
          </button>
          {onExcel && (
            <button
              type="button"
              onClick={onExcel}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Excel 내보내기
            </button>
          )}
        </div>

        <div
          className="report-a4 bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden"
          style={{
            maxWidth: 210 * (96 / 25.4),
            minHeight: 297 * (96 / 25.4) * 0.5,
            margin: "0 auto",
          }}
        >
          <div className="p-6 md:p-8">
            <header className="border-b border-gray-200 pb-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {logoUrl && (
                    <img src={logoUrl} alt="로고" className="h-12 w-auto object-contain" />
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-[#1e3a5f]">{churchName || "교회"}</h1>
                    <p className="text-lg font-semibold text-gray-700 mt-0.5">{title}</p>
                    {period && <p className="text-sm text-gray-500 mt-1">{period}</p>}
                  </div>
                </div>
                {!logoUrl && churchName && <h1 className="text-xl font-bold text-[#1e3a5f]">{churchName}</h1>}
              </div>
              <p className="text-xs text-gray-400 mt-2">작성일: {new Date().toLocaleDateString("ko-KR")}</p>
            </header>

            <div className="report-body">{children}</div>

            <footer className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
              {FOOTER_TEXT}
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}

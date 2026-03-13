import React, { forwardRef } from "react";

interface KakaoShareCardProps {
  churchName: string;
  worshipName: string;
  date: string;
  time: string;
  leader: string;
  preacher: string;
  bibleVerse: string;
  sermonTitle: string;
  location: string;
  message?: string;
  designTheme?: "navy" | "burgundy" | "olive";
}

const themes = {
  navy: { bg: "#1e2a4a", accent: "#3b5998", text: "#ffffff" },
  burgundy: { bg: "#4a1e2a", accent: "#8b3a4a", text: "#ffffff" },
  olive: { bg: "#2a3a1e", accent: "#5a7a3a", text: "#ffffff" },
};

const KakaoShareCard = forwardRef<HTMLDivElement, KakaoShareCardProps>(
  (
    {
      churchName,
      worshipName,
      date,
      time,
      leader,
      preacher,
      bibleVerse,
      sermonTitle,
      location,
      message,
      designTheme = "navy",
    },
    ref,
  ) => {
    const theme = themes[designTheme];

    const rows = [
      ["예배일", date],
      ["예배시간", time],
      ["인도자", leader],
      ["설교자", preacher],
      ["성경봉독", bibleVerse],
      ["말씀", sermonTitle],
      ["장소", location],
    ].filter(([, val]) => val);

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            backgroundColor: theme.bg,
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4, letterSpacing: 2 }}>✝</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>{churchName}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.text, marginBottom: 4 }}>{worshipName}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{date}</div>
        </div>

        <div style={{ padding: 24 }}>
          <table style={{ width: "100%", fontSize: 14, color: "#374151", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map(([label, value], i) => (
                <tr key={i}>
                  <td style={{ padding: "6px 0", fontWeight: 600, color: "#6b7280", width: 80, verticalAlign: "top" }}>{label}</td>
                  <td style={{ padding: "6px 0", color: "#111827" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {message && (
          <div
            style={{
              padding: "16px 24px 24px",
              fontSize: 14,
              lineHeight: 1.7,
              color: "#374151",
              borderTop: "1px solid #f3f4f6",
              whiteSpace: "pre-line",
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            backgroundColor: "#f9fafb",
            padding: "12px 24px",
            textAlign: "center",
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          {churchName}
        </div>
      </div>
    );
  },
);

KakaoShareCard.displayName = "KakaoShareCard";
export default KakaoShareCard;

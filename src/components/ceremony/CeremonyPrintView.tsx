"use client";

/**
 * 예식 가이드 — A4 인쇄 전용 뷰 ("Refined Modern with Color")
 *
 *   디자인 컨셉
 *     - 고급 호텔 청첩장 / 프리미엄 브로셔 수준의 디테일.
 *     - 카테고리별 액센트 컬러 (장례/추도=슬레이트 블루, 결혼=샴페인 골드 등)
 *       위에 따뜻한 아이보리 종이 + 부드러운 잉크 본문.
 *     - 식순지(participant): 명조 통일, 점·다이아·한자 식순 제목, 두자리 번호.
 *     - 인도자용(leader): 헤더 명조, 큰 번호는 클래식 세리프, 본문 산세리프.
 *
 *   화면 노출 없음. @media print 진입 시에만 보이며, 실제 DOM 마운트는
 *   React Portal 로 document.body 직속 (`.ceremony-print-root`).
 */

import type {
  CeremonySession,
  CeremonyTemplate,
  CeremonyStep,
  Member,
} from "@/types/db";
import { substituteCeremonyPlaceholders } from "@/lib/ceremony";

/* ──────────────────────────────────────────
 *  Props
 * ────────────────────────────────────────── */
export interface CeremonyPrintViewProps {
  mode: "participant" | "leader";
  session: CeremonySession;
  template: CeremonyTemplate;
  steps: CeremonyStep[];        // step_order asc 정렬 완료된 상태
  churchName: string;
  subjectMember?: Member | null;
  /**
   * 두 번째 대상자 (결혼예식 신부 등).
   * 결혼 카테고리일 때 헤더에 "신랑 ○○○ · 신부 ○○○" 형태로 함께 노출.
   */
  partnerMember?: Member | null;
  leaderName?: string | null;
}

/* ──────────────────────────────────────────
 *  컬러 시스템 — 인쇄 전용
 * ────────────────────────────────────────── */
const PAPER = "#FAFAF7";
const INK = "#1A1A1A";
const SUB = "#6B6760";
const RULE = "#D4CFC4";

/** 카테고리별 액센트 컬러 */
function getAccentByCategory(category: string | null | undefined): string {
  switch (category) {
    case "funeral":
    case "memorial":
      return "#3A4A5C"; // deep slate blue — 정중함
    case "visit":
    case "communion":
      return "#5C4A3A"; // warm brown — 경건함
    case "holiday":
      return "#A0522D"; // sienna — 가족적 온기
    case "wedding":
      return "#B08D57"; // champagne gold — 화사함
    case "ordination":
    case "newyear":
      return "#7A2E2E"; // deep wine — 엄숙함
    case "easter":
      return "#2E7A5C"; // deep green — 생명
    default:
      return "#3A4A5C";
  }
}

/* ──────────────────────────────────────────
 *  폰트 시스템
 * ────────────────────────────────────────── */
const FONT_DISPLAY =
  '"Nanum Myeongjo", "Noto Serif KR", "Batang", "본명조", serif';
const FONT_BODY = "var(--font-sans)";
const FONT_NUMERIC =
  '"Cormorant Garamond", "Nanum Myeongjo", "Noto Serif KR", serif';

/* ──────────────────────────────────────────
 *  헬퍼
 * ────────────────────────────────────────── */
const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * "2026년 5월 27일 수요일"
 *
 * 과거에는 `주후 2026년...` 접두사를 사용했으나, 모던한 식순지 디자인과 어울리지
 * 않아 제거했다. 모든 카테고리(결혼·세례·임직 등)에서 공통으로 사용 가능한
 * 깔끔한 한국어 날짜 표기로 통일.
 */
function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "일시 미정";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "일시 미정";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_KR[d.getDay()]}요일`;
}

/** "오전 11시" / "오후 2시 30분" */
function fmtTimeNarr(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  const am = h < 12;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${am ? "오전" : "오후"} ${h12}시`;
  return `${am ? "오전" : "오후"} ${h12}시 ${m}분`;
}

/** "2026.05.27 (수)" — 인도자용 헤더 */
function fmtDateDot(iso: string | null | undefined): string {
  if (!iso) return "일시 미정";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "일시 미정";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}.${mo}.${da} (${WEEKDAY_KR[d.getDay()]})`;
}

function joinNonEmpty(parts: Array<string | null | undefined>, sep: string): string {
  return parts.filter((p) => p && p.trim().length > 0).join(sep);
}

/** 카테고리에 따라 대상자 라벨 라인 구성 */
function getSubjectLine(
  category: string | null | undefined,
  subjectMember: Member | null | undefined,
  partnerMember?: Member | null | undefined,
): string | null {
  const name = subjectMember?.name ?? null;
  const partnerName = partnerMember?.name ?? null;
  switch (category) {
    case "funeral":
    case "memorial":
      return name ? `故 ${name} 성도` : null;
    case "visit":
      return name ? `${name} 가정` : null;
    case "wedding": {
      // 결혼: 신랑·신부를 함께 노출. 한쪽만 선택돼 있어도 표기.
      const groom = name ? `신랑 ${name}` : null;
      const bride = partnerName ? `신부 ${partnerName}` : null;
      const combined = joinNonEmpty([groom, bride], "  ·  ");
      return combined.length > 0 ? combined : null;
    }
    default:
      return name;
  }
}

/* ──────────────────────────────────────────
 *  Decoration components
 * ────────────────────────────────────────── */
function Dots({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        textAlign: "center",
        color,
        fontSize: `${size}pt`,
        letterSpacing: "0.7em",
        lineHeight: 1,
      }}
    >
      · · · · · · · · ·
    </div>
  );
}

function DiamondRule({
  color,
  compact = false,
}: {
  color: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10pt",
        margin: compact ? "4pt 0" : "10pt 0",
      }}
    >
      <span
        style={{
          flex: "0 1 130pt",
          height: "0.6pt",
          background: color,
        }}
      />
      <span
        style={{
          color,
          fontSize: "9pt",
          lineHeight: 1,
        }}
      >
        ◆
      </span>
      <span
        style={{
          flex: "0 1 130pt",
          height: "0.6pt",
          background: color,
        }}
      />
    </div>
  );
}

function LineDots({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      style={{
        textAlign: "center",
        color,
        opacity: 0.7,
        letterSpacing: "0.6em",
        fontSize: "10pt",
        margin: "18pt 0 22pt",
        lineHeight: 1,
      }}
    >
      ─ ─ ─ ─ ─
    </div>
  );
}

/* ──────────────────────────────────────────
 *  Participant — 식순지
 * ────────────────────────────────────────── */
function ParticipantView({
  session,
  template,
  steps,
  churchName,
  subjectMember,
  partnerMember,
  leaderName,
  accent,
}: {
  session: CeremonySession;
  template: CeremonyTemplate;
  steps: CeremonyStep[];
  churchName: string;
  subjectMember: Member | null | undefined;
  partnerMember: Member | null | undefined;
  leaderName: string | null | undefined;
  accent: string;
}) {
  const subjectLine = getSubjectLine(template.category, subjectMember, partnerMember);
  const dateLine = fmtDateLong(session.scheduled_at);
  const timeLoc = joinNonEmpty(
    [fmtTimeNarr(session.scheduled_at), session.location],
    " · ",
  );

  const displayChurchName =
    churchName && churchName.trim().length > 0 ? churchName : "교회";

  return (
    <article
      style={{
        fontFamily: FONT_DISPLAY,
        color: INK,
        background: PAPER,
        /* 4면 닫힌 액자. minHeight 로 페이지 끝까지 확장 + flex column 으로
         * 푸터를 액자 하단에 고정. */
        border: `0.7pt solid ${accent}`,
        padding: "36pt 38pt 36pt",
        minHeight: "267mm",
        boxSizing: "border-box",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── 상단 점 장식 ── */}
      <div style={{ marginTop: 0 }}>
        <Dots color={accent} size={9} />
      </div>

      {/* ── 교회명 ── */}
      <div
        style={{
          textAlign: "center",
          marginTop: "10pt",
          color: accent,
          fontSize: "14pt",
          letterSpacing: "0.45em",
          paddingLeft: "0.45em",
          fontWeight: 500,
        }}
      >
        {displayChurchName}
      </div>

      {/* ── 다이아 가로 라인 ── */}
      <div style={{ marginTop: "6pt" }}>
        <DiamondRule color={accent} compact />
      </div>

      {/* ── 대상자 + 예식 명 ── */}
      <div style={{ textAlign: "center", margin: "14pt 0 10pt" }}>
        {subjectLine ? (
          <div
            style={{
              fontSize: "16pt",
              color: INK,
              letterSpacing: "0.35em",
              paddingLeft: "0.35em",
              marginBottom: "8pt",
              lineHeight: 1.4,
            }}
          >
            {subjectLine}
          </div>
        ) : null}
        <div
          style={{
            fontSize: "24pt",
            color: INK,
            letterSpacing: "0.45em",
            paddingLeft: "0.45em",
            lineHeight: 1.3,
            fontWeight: 500,
          }}
        >
          {subjectLine ? template.name : session.title || "(제목 없음)"}
        </div>
      </div>

      {/* ── 일시·장소·인도자 ── */}
      <div
        style={{
          textAlign: "center",
          color: INK,
          fontSize: "10.5pt",
          lineHeight: 1.7,
          margin: "0 0 4pt",
          letterSpacing: "0.05em",
        }}
      >
        <div>{dateLine}</div>
        {timeLoc ? <div>{timeLoc}</div> : null}
        {leaderName ? (
          <div style={{ color: SUB, fontSize: "10pt", marginTop: "2pt" }}>
            인도 {leaderName}
          </div>
        ) : null}
      </div>

      {/* ── 가는 라인(상단 헤더와 식순 본문 분리) ── */}
      <hr
        style={{
          border: 0,
          borderTop: `0.5pt solid ${RULE}`,
          margin: "14pt 28% 18pt",
        }}
      />

      {/* ── 식순 리스트 ── */}
      <ol
        style={{
          listStyle: "none",
          padding: "0 18pt",
          margin: 0,
        }}
      >
        {steps.map((s, i) => {
          const c = s.content ?? {};
          const hasHymns = (c.hymn_numbers?.length ?? 0) > 0;
          const hasScriptures = (c.scriptures?.length ?? 0) > 0;
          const rightLabel = hasHymns ? "다 함 께" : "인 도 자";
          // 번호는 필터링 후 1..N 으로 연속 (체크 해제로 빠진 step 의 자리를 채움)
          const stepNo = i + 1;

          return (
            <li
              key={s.id}
              className="ceremony-print-step"
              style={{ marginBottom: "1pt" }}
            >
              {/* 본 라인 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  padding: "2pt 0",
                  gap: "14pt",
                }}
              >
                <span
                  style={{
                    width: "26pt",
                    flexShrink: 0,
                    color: accent,
                    fontFamily: FONT_NUMERIC,
                    fontSize: "14pt",
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                  }}
                >
                  {String(stepNo).padStart(2, "0")}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: "12.5pt",
                    letterSpacing: "0.5em",
                    paddingLeft: "0.5em",
                    color: INK,
                    lineHeight: 1.4,
                  }}
                >
                  {s.title}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "9pt",
                    letterSpacing: "0.3em",
                    paddingLeft: "0.3em",
                    color: SUB,
                  }}
                >
                  {rightLabel}
                </span>
              </div>

              {/* 찬송 ref */}
              {hasHymns ? (
                <div
                  style={{
                    paddingLeft: "42pt",
                    color: accent,
                    fontSize: "9.5pt",
                    marginTop: "0pt",
                    letterSpacing: "0.05em",
                  }}
                >
                  찬송가 {c.hymn_numbers!.map((n) => `${n}장`).join("  ·  ")}
                </div>
              ) : null}

              {/* 성경 ref */}
              {hasScriptures ? (
                <div
                  style={{
                    paddingLeft: "42pt",
                    color: accent,
                    fontSize: "9.5pt",
                    marginTop: "0pt",
                    letterSpacing: "0.05em",
                  }}
                >
                  성경 {c.scriptures!.map((sc) => sc.ref).join("  /  ")}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* ── 푸터 클러스터 — flex column 의 마지막 자식이며 marginTop:auto 로
       *    액자 하단에 고정 (콘텐츠가 짧아도 빈 하단이 생기지 않고 푸터가
       *    페이지 바닥에 붙는다). 분리 불가 블록으로 보호. ── */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "20pt",
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        {/* 다이아 가로 라인 */}
        <DiamondRule color={accent} compact />

        {/* 푸터 메시지 */}
        <div
          style={{
            textAlign: "center",
            color: INK,
            fontSize: "10pt",
            letterSpacing: "0.15em",
            paddingLeft: "0.15em",
            margin: "8pt 0 8pt",
          }}
        >
          {getFooterMessage(template.category)}
        </div>

        {/* 교회명 */}
        <div
          style={{
            textAlign: "center",
            color: accent,
            fontSize: "9.5pt",
            letterSpacing: "0.45em",
            paddingLeft: "0.45em",
            marginBottom: "4pt",
          }}
        >
          {displayChurchName}
        </div>

        {/* 작은 십자가 */}
        <div
          aria-hidden
          style={{
            textAlign: "center",
            color: accent,
            fontSize: "9pt",
            lineHeight: 1,
          }}
        >
          ✚
        </div>
      </div>
    </article>
  );
}

function getFooterMessage(category: string | null | undefined): string {
  switch (category) {
    case "funeral":
      return "주의 평안이 유가족 위에 영원히 함께하시기를";
    case "memorial":
      return "사랑하는 故인의 영원한 안식을 기억하며";
    case "visit":
      return "주의 평강이 이 가정 위에 가득하시기를";
    case "wedding":
      return "주께서 두 사람을 늘 하나로 묶으시기를";
    case "easter":
      return "부활하신 주의 생명이 우리 가운데 가득하시기를";
    case "communion":
      return "거룩한 식탁의 은혜가 우리 모두에게";
    default:
      return "주의 은혜와 평강이 우리 가운데 함께하시기를";
  }
}

/* ──────────────────────────────────────────
 *  Leader — 인도자용
 * ────────────────────────────────────────── */
function LeaderView({
  session,
  template,
  steps,
  churchName,
  subjectMember,
  partnerMember,
  leaderName,
  accent,
}: {
  session: CeremonySession;
  template: CeremonyTemplate;
  steps: CeremonyStep[];
  churchName: string;
  subjectMember: Member | null | undefined;
  partnerMember: Member | null | undefined;
  leaderName: string | null | undefined;
  accent: string;
}) {
  const subjectLine = getSubjectLine(template.category, subjectMember, partnerMember);
  const dateLine = fmtDateLong(session.scheduled_at);
  const timeLoc = joinNonEmpty(
    [fmtTimeNarr(session.scheduled_at), session.location],
    " · ",
  );

  const displayChurchName =
    churchName && churchName.trim().length > 0 ? churchName : "교회";

  return (
    <div style={{ position: "relative", background: PAPER, color: INK }}>
      {/* 4면 액자 — position:fixed 로 매 페이지 동일 위치에 반복 렌더링.
       * border-color 는 카테고리 액센트 인라인 주입. */}
      <div
        aria-hidden
        className="ceremony-leader-frame"
        style={{ borderColor: accent }}
      />

      {/* 본문은 <table> 로 감싸 thead 가 매 페이지 위에 자동 반복(상단 여백)
       * 되고, tfoot 은 Chrome 동작상 마지막 페이지 콘텐츠 끝에 1회 렌더링되어
       * footer cluster 가 자연스럽게 마지막 페이지 하단 부근에 자리한다.
       * minHeight=259mm 으로 단일 페이지 콘텐츠인 경우에도 표가 인쇄 영역
       * 전체를 채우도록 해 footer 가 페이지 바닥에 붙는다. */}
      <table
        className="ceremony-leader-table"
        style={{
          fontFamily: FONT_DISPLAY,
          color: INK,
          minHeight: "259mm",
        }}
      >
        <thead>
          <tr>
            <td style={{ height: "26pt", padding: 0, border: 0 }} />
          </tr>
        </thead>
        {/* tfoot = 마지막 페이지 콘텐츠 끝에 1회 렌더링 (Chrome 동작). 
         * footer cluster 를 여기 두면 자연스럽게 마지막 페이지 하단 부근에
         * 고정된다 (콘텐츠 직후 + bottom 스페이서 패딩). */}
        <tfoot>
          <tr>
            <td
              style={{
                padding: "20pt 38pt 22pt",
                border: 0,
                verticalAlign: "bottom",
              }}
            >
              <div
                style={{
                  breakInside: "avoid",
                  pageBreakInside: "avoid",
                }}
              >
                <DiamondRule color={accent} compact />
                <div
                  style={{
                    textAlign: "center",
                    color: INK,
                    fontSize: "10pt",
                    letterSpacing: "0.15em",
                    paddingLeft: "0.15em",
                    margin: "8pt 0 8pt",
                  }}
                >
                  {getFooterMessage(template.category)}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: accent,
                    fontSize: "9.5pt",
                    letterSpacing: "0.45em",
                    paddingLeft: "0.45em",
                    marginBottom: "4pt",
                  }}
                >
                  {displayChurchName}
                </div>
                <div
                  aria-hidden
                  style={{
                    textAlign: "center",
                    color: accent,
                    fontSize: "9pt",
                    lineHeight: 1,
                  }}
                >
                  ✚
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td
              style={{
                padding: "0 38pt",
                verticalAlign: "top",
                border: 0,
              }}
            >
      {/* ── 상단 점 장식 ── */}
      <div style={{ marginTop: 0 }}>
        <Dots color={accent} size={9} />
      </div>

      {/* ── 교회명 ── */}
      <div
        style={{
          textAlign: "center",
          marginTop: "10pt",
          color: accent,
          fontSize: "14pt",
          letterSpacing: "0.45em",
          paddingLeft: "0.45em",
          fontWeight: 500,
        }}
      >
        {displayChurchName}
      </div>
      {/* 인도자용 페이지 카운터 (영문 부제 제거) */}
      <div
        style={{
          textAlign: "center",
          marginTop: "3pt",
          color: SUB,
          fontFamily: FONT_NUMERIC,
          fontSize: "8pt",
          letterSpacing: "0.4em",
          paddingLeft: "0.4em",
          fontWeight: 400,
        }}
      >
        <span className="ceremony-page-counter" />
      </div>

      {/* ── 다이아 가로 라인 ── */}
      <DiamondRule color={accent} compact />

      {/* ── 대상자 + 예식 명 ── */}
      <div style={{ textAlign: "center", margin: "14pt 0 10pt" }}>
        {subjectLine ? (
          <div
            style={{
              fontSize: "16pt",
              color: INK,
              letterSpacing: "0.35em",
              paddingLeft: "0.35em",
              marginBottom: "8pt",
              lineHeight: 1.4,
            }}
          >
            {subjectLine}
          </div>
        ) : null}
        <div
          style={{
            fontSize: "24pt",
            color: INK,
            letterSpacing: "0.45em",
            paddingLeft: "0.45em",
            lineHeight: 1.3,
            fontWeight: 500,
          }}
        >
          {subjectLine ? template.name : session.title || "(제목 없음)"}
        </div>
      </div>

      {/* ── 일시·장소·인도자 ── */}
      <div
        style={{
          textAlign: "center",
          color: INK,
          fontSize: "10.5pt",
          lineHeight: 1.7,
          margin: "0 0 4pt",
          letterSpacing: "0.05em",
        }}
      >
        <div>{dateLine}</div>
        {timeLoc ? <div>{timeLoc}</div> : null}
        {leaderName ? (
          <div style={{ color: SUB, fontSize: "10pt", marginTop: "2pt" }}>
            인도 {leaderName}
          </div>
        ) : null}
      </div>

      {/* ── 가는 라인 ── */}
      <hr
        style={{
          border: 0,
          borderTop: `0.5pt solid ${RULE}`,
          margin: "14pt 28% 18pt",
        }}
      />

      {/* ── 식순 리스트 (식순지와 동일한 번호+제목 라인 + 인도자 콘텐츠) ── */}
      <ol
        style={{
          listStyle: "none",
          padding: "0 18pt",
          margin: 0,
        }}
      >
        {steps.map((s, i) => {
          const c = s.content ?? {};
          const isLast = i === steps.length - 1;
          // 템플릿의 ○○○ 자리표시자 → 실제 선택된 신랑·신부(또는 단일 대상자) 이름으로 치환
          const substCtx = {
            category: template.category,
            subjectName: subjectMember?.name ?? null,
            partnerName: partnerMember?.name ?? null,
          };
          const leaderScript = substituteCeremonyPlaceholders(c.leader_script, substCtx);
          const tips = substituteCeremonyPlaceholders(c.tips, substCtx);
          const prayerExamples = (c.prayer_examples ?? []).map((p) =>
            substituteCeremonyPlaceholders(p, substCtx),
          );
          const hasContent =
            !!leaderScript ||
            (prayerExamples.length > 0) ||
            (c.scriptures && c.scriptures.length > 0) ||
            (c.hymn_numbers && c.hymn_numbers.length > 0) ||
            !!tips;

          return (
            <li
              key={s.id}
              className="ceremony-print-step"
              style={{
                marginBottom: isLast ? 0 : "14pt",
                paddingTop: i === 0 ? 0 : "2pt",
              }}
            >
              {/* 단계 머리 라인 — 식순지와 동일 포맷 (번호 + 제목 + 우측 시간) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  padding: "2pt 0",
                  gap: "14pt",
                }}
              >
                <span
                  style={{
                    width: "26pt",
                    flexShrink: 0,
                    color: accent,
                    fontFamily: FONT_NUMERIC,
                    fontSize: "14pt",
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: "12.5pt",
                    letterSpacing: "0.5em",
                    paddingLeft: "0.5em",
                    color: INK,
                    lineHeight: 1.4,
                  }}
                >
                  {s.title}
                  {s.is_optional ? (
                    <span
                      style={{
                        fontSize: "9pt",
                        color: SUB,
                        letterSpacing: "0.1em",
                        marginLeft: "8pt",
                      }}
                    >
                      (선택)
                    </span>
                  ) : null}
                </span>
                {s.duration_minutes ? (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: "9pt",
                      letterSpacing: "0.2em",
                      paddingLeft: "0.2em",
                      color: SUB,
                    }}
                  >
                    약 {s.duration_minutes}분
                  </span>
                ) : null}
              </div>

              {/* 인도자 콘텐츠 — 번호 아래 들여쓰기 */}
              {hasContent ? (
                <div style={{ marginLeft: "40pt", marginTop: "8pt" }}>
                  {leaderScript ? (
                    <ContentBlock title="인 도 자  멘 트" accent={accent}>
                      <div
                        style={{
                          fontSize: "10.5pt",
                          lineHeight: 1.75,
                          color: INK,
                          whiteSpace: "pre-wrap",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {leaderScript}
                      </div>
                    </ContentBlock>
                  ) : null}

                  {prayerExamples.length > 0 ? (
                    <ContentBlock title="기 도 문" accent={accent} thick>
                      {prayerExamples.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: "10pt",
                            lineHeight: 1.75,
                            color: INK,
                            whiteSpace: "pre-wrap",
                            letterSpacing: "0.02em",
                            marginBottom:
                              idx === prayerExamples.length - 1 ? 0 : "8pt",
                          }}
                        >
                          {p}
                        </div>
                      ))}
                    </ContentBlock>
                  ) : null}

                  {c.scriptures && c.scriptures.length > 0 ? (
                    <ContentBlock title="성   경" accent={accent}>
                      {c.scriptures.map((sc, idx) => (
                        <div
                          key={`${sc.ref}-${idx}`}
                          style={{
                            fontSize: "10pt",
                            lineHeight: 1.65,
                            color: INK,
                            marginBottom:
                              idx === c.scriptures!.length - 1 ? 0 : "6pt",
                            letterSpacing: "0.02em",
                          }}
                        >
                          <span style={{ fontWeight: 700, color: accent }}>
                            {sc.ref}
                          </span>
                          {sc.text ? (
                            <div
                              style={{
                                fontSize: "9.5pt",
                                color: INK,
                                whiteSpace: "pre-wrap",
                                marginTop: "3pt",
                                lineHeight: 1.65,
                              }}
                            >
                              {sc.text}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </ContentBlock>
                  ) : null}

                  {c.hymn_numbers && c.hymn_numbers.length > 0 ? (
                    <ContentBlock title="찬   송" accent={accent}>
                      <div
                        style={{
                          fontSize: "10.5pt",
                          color: INK,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {c.hymn_numbers
                          .map((n) => `찬송가 ${n}장`)
                          .join("   ·   ")}
                      </div>
                    </ContentBlock>
                  ) : null}

                  {tips ? (
                    <ContentBlock title="진 행  팁" accent={accent} subtle>
                      <div
                        style={{
                          fontSize: "9.5pt",
                          color: SUB,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.65,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {tips}
                      </div>
                    </ContentBlock>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 좌측 세로 라인 + 소제목 + 본문. thick=기도문(3pt), subtle=팁(0.8pt) */
function ContentBlock({
  title,
  accent,
  thick,
  subtle,
  children,
}: {
  title: string;
  accent: string;
  thick?: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  const lineWidth = thick ? "3pt" : subtle ? "0.8pt" : "2pt";
  const lineColor = subtle ? RULE : accent;
  return (
    <div
      style={{
        display: "flex",
        marginBottom: "14pt",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      <div
        aria-hidden
        style={{
          width: lineWidth,
          background: lineColor,
          flexShrink: 0,
          marginRight: "14pt",
          alignSelf: "stretch",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "10pt",
            fontWeight: 700,
            color: subtle ? SUB : accent,
            letterSpacing: "0.3em",
            paddingLeft: "0.3em",
            marginBottom: "8pt",
            fontFamily: FONT_BODY,
          }}
        >
          {title}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
 *  Main export
 * ────────────────────────────────────────── */
export function CeremonyPrintView({
  mode,
  session,
  template,
  steps,
  churchName,
  subjectMember,
  partnerMember,
  leaderName,
}: CeremonyPrintViewProps) {
  const accent = getAccentByCategory(template.category);

  return (
    <div
      className={mode === "leader" ? "ceremony-leader" : "ceremony-participant"}
      style={{ background: PAPER, color: INK }}
    >
      {mode === "participant" ? (
        <ParticipantView
          session={session}
          template={template}
          steps={steps}
          churchName={churchName}
          subjectMember={subjectMember}
          partnerMember={partnerMember}
          leaderName={leaderName}
          accent={accent}
        />
      ) : (
        <LeaderView
          session={session}
          template={template}
          steps={steps}
          churchName={churchName}
          subjectMember={subjectMember}
          partnerMember={partnerMember}
          leaderName={leaderName}
          accent={accent}
        />
      )}
    </div>
  );
}

export default CeremonyPrintView;

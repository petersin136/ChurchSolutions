/**
 * 목록/출석부 등에서 직분 칸을 보기 쉽게 표기.
 * - 집사·권사·전도사·교사 등 실제 직분이면 그 값을 우선
 * - 성도·청년·학생처럼 일반 신분(또는 비어 있음)이면 부서에 맞게 표시
 */
const GENERIC_ROLES = new Set(["성도", "청년", "학생", "아기", "어린이"]);

function isSpecificRole(role: string): boolean {
  return role.length > 0 && !GENERIC_ROLES.has(role);
}

function roleFromDept(dept: string): string | null {
  if (/영아|유아|유치/.test(dept)) return "아기";
  if (/초등|유년/.test(dept)) return "어린이";
  if (/중고등|중등|고등/.test(dept)) return "학생";
  if (/청년/.test(dept)) return "청년";
  if (/장년/.test(dept)) return "성도";
  return null;
}

export function formatMemberRoleDisplay(
  role?: string | null,
  dept?: string | null
): string {
  const r = (role || "").trim();
  const d = (dept || "").trim();

  if (isSpecificRole(r)) return r;

  const fromDept = d ? roleFromDept(d) : null;
  if (fromDept) return fromDept;

  return r || "-";
}

import type { Member, Settings } from "@/types/db";

export type BaptismTerminology = "chimrye" | "seryae";
export type BaptismTerminologySetting = BaptismTerminology | "auto";

export interface BaptismTermLabels {
  useChimrye: boolean;
  baptism: string;
  baptismDate: string;
  baptismType: string;
  baptismFamilySection: string;
  baptismCertificate: string;
  baptismCertificateTitle: string;
  baptismAnniversary: string;
  ceremonyTabLabel: string;
  hideInfantBaptism: boolean;
}

const BAPTISM_TYPES_ALL: Member["baptism_type"][] = ["유아세례", "세례", "입교", "미세례"];

/** 교단명에 '침례'가 포함되면 침례 표기로 추론 */
export function inferBaptismTerminologyFromDenomination(denomination?: string | null): BaptismTerminology {
  const d = denomination?.trim();
  if (d && d.includes("침례")) return "chimrye";
  return "seryae";
}

export function resolveBaptismTerminology(
  settings: Pick<Settings, "baptismTerminology" | "denomination">,
): BaptismTerminology {
  if (settings.baptismTerminology === "chimrye" || settings.baptismTerminology === "seryae") {
    return settings.baptismTerminology;
  }
  return inferBaptismTerminologyFromDenomination(settings.denomination);
}

export function usesChimryeTerminology(
  settings: Pick<Settings, "baptismTerminology" | "denomination">,
): boolean {
  return resolveBaptismTerminology(settings) === "chimrye";
}

export function getBaptismTermLabels(
  settings: Pick<Settings, "baptismTerminology" | "denomination">,
): BaptismTermLabels {
  const useChimrye = usesChimryeTerminology(settings);
  return {
    useChimrye,
    baptism: useChimrye ? "침례" : "세례",
    baptismDate: useChimrye ? "침례일" : "세례일",
    baptismType: useChimrye ? "침례 구분" : "세례 구분",
    baptismFamilySection: useChimrye ? "침례/가족" : "세례/가족",
    baptismCertificate: useChimrye ? "침례증명서" : "세례증명서",
    baptismCertificateTitle: useChimrye ? "침 례 증 명 서" : "세 례 증 명 서",
    baptismAnniversary: useChimrye ? "침례기념일" : "세례기념일",
    ceremonyTabLabel: useChimrye ? "침례" : "세례",
    hideInfantBaptism: useChimrye,
  };
}

export function displayBaptismType(
  baptismType: Member["baptism_type"] | null | undefined,
  settings: Pick<Settings, "baptismTerminology" | "denomination">,
): string {
  if (!baptismType) return "-";
  if (usesChimryeTerminology(settings) && baptismType === "세례") return "침례";
  return baptismType;
}

export function getBaptismTypeOptions(
  settings: Pick<Settings, "baptismTerminology" | "denomination">,
): { value: Member["baptism_type"]; label: string }[] {
  const labels = getBaptismTermLabels(settings);
  if (labels.useChimrye) {
    return [
      { value: "세례", label: "침례" },
      { value: "입교", label: "입교" },
      { value: "미세례", label: "미세례" },
    ];
  }
  return BAPTISM_TYPES_ALL.map((b) => ({ value: b, label: b as string }));
}

export function transformBaptismStatsLabel(
  name: string,
  settings: Pick<Settings, "baptismTerminology" | "denomination">,
): string | null {
  const labels = getBaptismTermLabels(settings);
  if (labels.hideInfantBaptism && name === "유아세례") return null;
  if (labels.useChimrye && name === "세례") return "침례";
  return name;
}

export interface CeremonyCategoryTab {
  id: string;
  label: string;
  categories: readonly string[] | null;
  matchUnknown?: boolean;
}

export function getCeremonyCategoryTabs(
  settings: Pick<Settings, "baptismTerminology" | "denomination">,
): CeremonyCategoryTab[] {
  const baptismLabel = getBaptismTermLabels(settings).ceremonyTabLabel;
  return [
    { id: "all", label: "전체", categories: null },
    { id: "funeral", label: "장례", categories: ["funeral"] },
    { id: "memorial", label: "추도예배", categories: ["memorial"] },
    { id: "visit", label: "심방예배", categories: ["visit"] },
    { id: "holiday", label: "명절", categories: ["holiday"] },
    { id: "communion", label: "성찬식", categories: ["communion"] },
    { id: "baptism", label: baptismLabel, categories: ["baptism"] },
    { id: "wedding", label: "결혼", categories: ["wedding"] },
    { id: "ordination", label: "임직", categories: ["ordination"] },
    { id: "etc", label: "기타", categories: null, matchUnknown: true },
  ];
}

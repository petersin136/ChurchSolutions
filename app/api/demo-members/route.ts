import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const SURNAMES = "김,이,박,최,정,강,조,윤,장,임,한,오,서,신,권,황,안,송,류,홍".split(",");
const MALE_NAMES = "민준,서준,도윤,예준,시우,하준,주원,지호,지환,준서,건우,현우,성민,재현,승현,태현,동현,정우,진우,영호,상훈,재석,용식,기태,병철,상수,영철,태식,종대,만수".split(",");
const FEMALE_NAMES = "서연,서윤,지우,서현,민서,하은,하윤,윤서,지유,채원,수아,지아,은서,다은,미영,정숙,영자,순옥,경희,은정,수진,혜진,유진,미란,정은,현주,소영,지영,은주,선희".split(",");

const ADDRESSES = [
  "경기도 포천시 소흘읍 이동교리",
  "경기도 포천시 포천동",
  "경기도 포천시 선단동",
  "경기도 포천시 영중면 영중리",
  "경기도 포천시 일동면 기산리",
  "경기도 포천시 신북면 신평리",
  "경기도 포천시 군내면 구읍리",
  "경기도 포천시 관인면 중리",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(yearMin: number, yearMax: number): string {
  const y = randomBetween(yearMin, yearMax);
  const m = randomBetween(1, 12);
  const d = randomBetween(1, 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function phoneFormat(): string {
  return `010-${randomBetween(1000, 9999)}-${randomBetween(1000, 9999)}`;
}

function addressWithNumber(base: string): string {
  if (base.includes("동")) return `${base} ${randomBetween(1, 200)}번지`;
  return `${base} ${randomBetween(1, 999)}-${randomBetween(1, 99)}`;
}

type Dept = "주일학교" | "중고등부" | "청년부" | "장년부";

interface DemoMemberRow {
  name: string;
  dept: string;
  role: string;
  birth: string;
  gender: string;
  phone: string;
  address: string;
  family: string | null;
  status: string;
  source: string | null;
  prayer: string | null;
  memo: string | null;
  mokjang: string | null;
  photo: string | null;
  created_at: string;
}

function buildDemoMembers(): DemoMemberRow[] {
  const rows: DemoMemberRow[] = [];
  const statusPool: ("정착중" | "새신자" | "미등록")[] = [
    ...Array(90).fill("정착중"),
    ...Array(7).fill("새신자"),
    ...Array(3).fill("미등록"),
  ].sort(() => Math.random() - 0.5);

  const usedNames = new Set<string>();
  function uniqueName(surname: string, name: string): string {
    const full = surname + name;
    if (usedNames.has(full)) return uniqueName(pick(SURNAMES), name);
    usedNames.add(full);
    return full;
  }

  // 10 families: same surname + same address
  const familyGroups: { surname: string; address: string; count: number }[] = [];
  for (let i = 0; i < 10; i++) {
    familyGroups.push({
      surname: pick(SURNAMES),
      address: addressWithNumber(pick(ADDRESSES)),
      count: i < 3 ? 4 : 3,
    });
  }
  let familyIndex = 0;
  let familySlot = 0;
  const totalFamilySlots = familyGroups.reduce((s, g) => s + g.count, 0); // 10*3~4 = 33

  const deptSlots: { dept: Dept; birthYearMin: number; birthYearMax: number }[] = [
    { dept: "주일학교", birthYearMin: 2013, birthYearMax: 2021 },
    { dept: "중고등부", birthYearMin: 2007, birthYearMax: 2012 },
    { dept: "청년부", birthYearMin: 1991, birthYearMax: 2006 },
    { dept: "장년부", birthYearMin: 1951, birthYearMax: 1990 },
  ];
  const counts = [20, 20, 20, 40];
  const 장년부Roles = ["성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "성도", "집사", "집사", "집사", "집사", "집사", "권사", "권사", "권사", "장로", "장로", "담임목사"];
  const 장년부RoleShuffle = [...장년부Roles].sort(() => Math.random() - 0.5);

  let 장년부RoleIdx = 0;

  for (let d = 0; d < 4; d++) {
    const { dept, birthYearMin, birthYearMax } = deptSlots[d];
    const n = counts[d];
    for (let i = 0; i < n; i++) {
      const isFamily = familySlot < totalFamilySlots;
      const surname = isFamily ? familyGroups[familyIndex].surname : pick(SURNAMES);
      const address = isFamily ? familyGroups[familyIndex].address : addressWithNumber(pick(ADDRESSES));

      const isMale = Math.random() < 0.5;
      const givenName = isMale ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
      const name = isFamily ? surname + givenName : uniqueName(surname, givenName);

      const birth = randomDate(birthYearMin, birthYearMax);
      const gender = isMale ? "남" : "여";
      const phone = dept === "주일학교" || dept === "중고등부" ? (Math.random() < 0.3 ? "-" : phoneFormat()) : phoneFormat();
      const status = statusPool[rows.length] ?? "정착중";
      const created_at = `${randomDate(2020, 2025)}T${String(randomBetween(9, 17)).padStart(2, "0")}:00:00.000Z`;

      let role = "성도";
      if (dept === "장년부") {
        role = 장년부RoleShuffle[장년부RoleIdx++] ?? "성도";
      }

      let family: string | null = null;
      if (isFamily && familyGroups[familyIndex].count > 1) {
        family = `${familyGroups[familyIndex].surname}가족`;
      }

      rows.push({
        name,
        dept,
        role,
        birth,
        gender,
        phone,
        address,
        family,
        status,
        source: null,
        prayer: null,
        memo: null,
        mokjang: null,
        photo: null,
        created_at,
      });

      if (isFamily) {
        familySlot++;
        if (familySlot >= familyGroups[familyIndex].count) {
          familyIndex++;
          familySlot = 0;
        }
      }
    }
  }

  return rows;
}

export async function POST() {
  try {
    const supabase = getServiceSupabase();
    const { count } = await supabase.from("members").select("id", { count: "exact", head: true });
    if (count != null && count > 0) {
      return NextResponse.json(
        { error: "기존 교인 데이터가 있습니다. 먼저 초기화해주세요." },
        { status: 400 }
      );
    }

    const members = buildDemoMembers();
    const { error } = await supabase.from("members").insert(members);
    if (error) throw error;

    return NextResponse.json({ ok: true, count: members.length });
  } catch (e) {
    console.error("demo-members error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "데모 데이터 생성 실패" },
      { status: 500 }
    );
  }
}

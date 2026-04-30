"use client";

import {
  Calendar,
  Grid3X3,
  LayoutList,
  Mail,
  Settings,
  User,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  PcBadge,
  PcSegmented,
  PcTable,
  type PcTableColumn,
  PcTabs,
  usePcToast,
} from "@/components/ui";
import d from "./DevComponents.module.css";

type Member = {
  name: string;
  gender: string;
  age: number;
  department: string;
  registeredAt: string;
  status: string;
};

const MEMBERS: Member[] = [
  { name: "김은혜", gender: "여", age: 34, department: "찬양팀", registeredAt: "2023-02-10", status: "활동" },
  { name: "이요셉", gender: "남", age: 42, department: "안내팀", registeredAt: "2022-11-05", status: "활동" },
  { name: "박가을", gender: "여", age: 28, department: "유년부", registeredAt: "2024-01-18", status: "활동" },
  { name: "최다니엘", gender: "남", age: 55, department: "집사회", registeredAt: "2021-08-22", status: "휴면" },
  { name: "정하나", gender: "여", age: 31, department: "교육팀", registeredAt: "2023-07-01", status: "활동" },
  { name: "한빛나", gender: "여", age: 26, department: "찬양팀", registeredAt: "2024-03-12", status: "활동" },
  { name: "서진우", gender: "남", age: 19, department: "청년부", registeredAt: "2023-12-20", status: "활동" },
  { name: "오미리암", gender: "여", age: 48, department: "선교회", registeredAt: "2020-05-14", status: "활동" },
  { name: "윤베드로", gender: "남", age: 37, department: "안내팀", registeredAt: "2022-09-30", status: "이전" },
  { name: "강사라", gender: "여", age: 22, department: "청년부", registeredAt: "2024-04-02", status: "활동" },
  { name: "문디모데", gender: "남", age: 61, department: "장로회", registeredAt: "2019-01-07", status: "활동" },
  { name: "홍디바", gender: "여", age: 29, department: "유년부", registeredAt: "2023-10-15", status: "활동" },
];

function memberColumns(extra?: {
  sortName?: boolean;
  sortAge?: boolean;
  sortDate?: boolean;
  stickyName?: boolean;
  wideDept?: boolean;
}): PcTableColumn<Member>[] {
  const { sortName, sortAge, sortDate, stickyName, wideDept } = extra ?? {};
  return [
    {
      key: "name",
      header: "이름",
      width: stickyName ? 140 : undefined,
      sortable: sortName,
      sortAccessor: (r) => r.name,
      sticky: stickyName ? "left" : undefined,
    },
    { key: "gender", header: "성별", width: 72, align: "center" },
    {
      key: "age",
      header: "나이",
      width: 80,
      align: "right",
      nowrap: true,
      sortable: sortAge,
      sortAccessor: (r) => r.age,
    },
    {
      key: "department",
      header: "부서",
      width: wideDept ? "var(--pc-table-demo-department-width)" : undefined,
    },
    {
      key: "registeredAt",
      header: "등록일",
      width: "110px",
      nowrap: true,
      sortable: sortDate,
      sortAccessor: (r) => r.registeredAt,
    },
    {
      key: "status",
      header: "상태",
      width: 100,
      align: "center",
      accessor: (r) => (
        <PcBadge variant={r.status === "활동" ? "green" : r.status === "휴면" ? "yellow" : "gray"}>
          {r.status}
        </PcBadge>
      ),
    },
  ];
}

export function DevWave5Demos() {
  const toast = usePcToast();

  const [tabU, setTabU] = useState("a");
  const [tabP, setTabP] = useState("list");
  const [tabB, setTabB] = useState("inbox");
  const [tabFw, setTabFw] = useState("one");

  const [seg1, setSeg1] = useState("week");
  const [seg2, setSeg2] = useState("list");
  const [segSm, setSegSm] = useState("a");
  const [segMd, setSegMd] = useState("a");
  const [segLg, setSegLg] = useState("a");
  const [segFw, setSegFw] = useState("x");
  const [seg5, setSeg5] = useState("1");

  const baseCols = useMemo(() => memberColumns(), []);
  const sortCols = useMemo(
    () => memberColumns({ sortName: true, sortAge: true, sortDate: true }),
    [],
  );
  const stickyCols = useMemo(
    () => memberColumns({ stickyName: true, wideDept: true }),
    [],
  );

  return (
    <>
      <section className={d.section}>
        <h2 className={d.h2}>PcTable</h2>
        <p className={d.note}>기본 (md, hoverable)</p>
        <div className={d.full}>
          <PcTable
            data={MEMBERS}
            columns={baseCols}
            rowKey={(r) => r.name}
            caption="교인 목록 샘플"
          />
        </div>

        <p className={`${d.note} ${d.rowGapTop}`}>striped + bordered + lg</p>
        <div className={d.full}>
          <PcTable
            data={MEMBERS}
            columns={baseCols}
            rowKey={(r) => r.name}
            size="lg"
            striped
            bordered
          />
        </div>

        <p className={`${d.note} ${d.rowGapTop}`}>정렬 (이름 / 나이 / 등록일)</p>
        <div className={d.full}>
          <PcTable
            data={MEMBERS}
            columns={sortCols}
            rowKey={(r) => r.name}
            defaultSort={{ key: "name", direction: "asc" }}
          />
        </div>

        <p className={`${d.note} ${d.rowGapTop}`}>행 클릭 → 토스트</p>
        <div className={d.full}>
          <PcTable
            data={MEMBERS}
            columns={baseCols}
            rowKey={(r) => r.name}
            onRowClick={(row) => toast.info(`${row.name} 행을 선택했습니다.`)}
          />
        </div>

        <p className={`${d.note} ${d.rowGapTop}`}>emptyState (빈 배열)</p>
        <div className={d.full}>
          <PcTable data={[]} columns={baseCols} rowKey={(_, i) => i} />
        </div>

        <p className={`${d.note} ${d.rowGapTop}`}>loading</p>
        <div className={d.full}>
          <PcTable data={MEMBERS} columns={baseCols} rowKey={(r) => r.name} loading />
        </div>

        <p className={`${d.note} ${d.rowGapTop}`}>sticky 이름 열 (좌측 고정)</p>
        <div className={d.full} style={{ overflowX: "auto" }}>
          <PcTable
            data={MEMBERS}
            columns={stickyCols}
            rowKey={(r) => r.name}
            bordered
            stickyHeader
          />
        </div>
      </section>

      <section className={d.section}>
        <h2 className={d.h2}>PcTabs</h2>
        <p className={d.note}>underline · 4탭</p>
        <PcTabs value={tabU} onValueChange={setTabU}>
          <PcTabs.List ariaLabel="데모 탭">
            <PcTabs.Trigger value="a">공지</PcTabs.Trigger>
            <PcTabs.Trigger value="b">일정</PcTabs.Trigger>
            <PcTabs.Trigger value="c">게시판</PcTabs.Trigger>
            <PcTabs.Trigger value="d">문의</PcTabs.Trigger>
          </PcTabs.List>
          <PcTabs.Content value="a">
            <p className={d.muted}>공지 탭 더미 본문입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="b">
            <p className={d.muted}>일정 탭 더미 본문입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="c">
            <p className={d.muted}>게시판 탭 더미 본문입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="d">
            <p className={d.muted}>문의 탭 더미 본문입니다.</p>
          </PcTabs.Content>
        </PcTabs>

        <p className={`${d.note} ${d.rowGapTop}`}>pill · 아이콘</p>
        <PcTabs value={tabP} onValueChange={setTabP} variant="pill">
          <PcTabs.List ariaLabel="보기 모드">
            <PcTabs.Trigger value="list" icon={<LayoutList size={16} />}>
              목록
            </PcTabs.Trigger>
            <PcTabs.Trigger value="grid" icon={<Grid3X3 size={16} />}>
              그리드
            </PcTabs.Trigger>
            <PcTabs.Trigger value="cal" icon={<Calendar size={16} />}>
              달력
            </PcTabs.Trigger>
          </PcTabs.List>
          <PcTabs.Content value="list">
            <p className={d.muted}>목록 보기 설명 텍스트입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="grid">
            <p className={d.muted}>그리드 보기 설명 텍스트입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="cal">
            <p className={d.muted}>달력 보기 설명 텍스트입니다.</p>
          </PcTabs.Content>
        </PcTabs>

        <p className={`${d.note} ${d.rowGapTop}`}>boxed · 배지</p>
        <PcTabs value={tabB} onValueChange={setTabB} variant="boxed">
          <PcTabs.List ariaLabel="메일함">
            <PcTabs.Trigger value="inbox" icon={<Mail size={16} />} badge={<PcBadge>12</PcBadge>}>
              받은편지함
            </PcTabs.Trigger>
            <PcTabs.Trigger value="sent" badge={<PcBadge variant="gray">0</PcBadge>}>
              보낸편지함
            </PcTabs.Trigger>
            <PcTabs.Trigger value="trash" badge={<PcBadge variant="red">3</PcBadge>}>
              휴지통
            </PcTabs.Trigger>
          </PcTabs.List>
          <PcTabs.Content value="inbox">
            <p className={d.muted}>받은편지함 콘텐츠 영역입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="sent">
            <p className={d.muted}>보낸편지함 콘텐츠 영역입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="trash">
            <p className={d.muted}>휴지통 콘텐츠 영역입니다.</p>
          </PcTabs.Content>
        </PcTabs>

        <p className={`${d.note} ${d.rowGapTop}`}>fullWidth + disabled 탭</p>
        <PcTabs value={tabFw} onValueChange={setTabFw} fullWidth>
          <PcTabs.List ariaLabel="전체 너비 탭">
            <PcTabs.Trigger value="one" icon={<User size={16} />}>
              프로필
            </PcTabs.Trigger>
            <PcTabs.Trigger value="two" disabled icon={<Settings size={16} />}>
              설정 (비활성)
            </PcTabs.Trigger>
            <PcTabs.Trigger value="three" icon={<Users size={16} />}>
              구성원
            </PcTabs.Trigger>
          </PcTabs.List>
          <PcTabs.Content value="one">
            <p className={d.muted}>프로필 탭입니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="two">
            <p className={d.muted}>접근할 수 없습니다.</p>
          </PcTabs.Content>
          <PcTabs.Content value="three">
            <p className={d.muted}>구성원 탭입니다.</p>
          </PcTabs.Content>
        </PcTabs>
      </section>

      <section className={d.section}>
        <h2 className={d.h2}>PcSegmented</h2>
        <p className={d.note}>주간 / 월간 / 연간</p>
        <PcSegmented
          value={seg1}
          onChange={setSeg1}
          ariaLabel="기간 선택"
          options={[
            { value: "week", label: "주간" },
            { value: "month", label: "월간" },
            { value: "year", label: "연간" },
          ]}
        />

        <p className={`${d.note} ${d.rowGapTop}`}>아이콘</p>
        <PcSegmented
          value={seg2}
          onChange={setSeg2}
          ariaLabel="보기 형식"
          options={[
            { value: "list", label: "목록", icon: <LayoutList size={14} /> },
            { value: "grid", label: "그리드", icon: <Grid3X3 size={14} /> },
            { value: "cal", label: "달력", icon: <Calendar size={14} /> },
          ]}
        />

        <p className={`${d.note} ${d.rowGapTop}`}>size sm / md / lg</p>
        <div className={d.rowTight}>
          <PcSegmented
            size="sm"
            value={segSm}
            onChange={setSegSm}
            ariaLabel="sm"
            options={[
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ]}
          />
          <PcSegmented
            size="md"
            value={segMd}
            onChange={setSegMd}
            ariaLabel="md"
            options={[
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ]}
          />
          <PcSegmented
            size="lg"
            value={segLg}
            onChange={setSegLg}
            ariaLabel="lg"
            options={[
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ]}
          />
        </div>

        <p className={`${d.note} ${d.rowGapTop}`}>fullWidth + disabled</p>
        <PcSegmented
          fullWidth
          value={segFw}
          onChange={setSegFw}
          ariaLabel="옵션 그룹"
          options={[
            { value: "x", label: "옵션 X" },
            { value: "y", label: "옵션 Y", disabled: true },
            { value: "z", label: "옵션 Z" },
          ]}
        />

        <p className={`${d.note} ${d.rowGapTop}`}>5옵션 fullWidth</p>
        <PcSegmented
          fullWidth
          value={seg5}
          onChange={setSeg5}
          ariaLabel="다섯 칸"
          options={[
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
            { value: "5", label: "5" },
          ]}
        />
      </section>
    </>
  );
}

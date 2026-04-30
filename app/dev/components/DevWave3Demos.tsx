"use client";

import { useState } from "react";
import { PcButton, PcConfirmDialog, PcSelect, PcTextarea } from "@/components/ui";
import d from "./DevComponents.module.css";

const BASE_OPTIONS = [
  { value: "a", label: "옵션 A" },
  { value: "b", label: "옵션 B" },
  { value: "c", label: "옵션 C" },
  { value: "d", label: "옵션 D" },
  { value: "e", label: "옵션 E (비활성)", disabled: true as const },
];

const BASE_ENABLED = BASE_OPTIONS.filter((o) => !o.disabled);

const KOREA_CITIES = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "수원", "고양", "용인", "창원", "성남", "청주", "전주", "천안",
  "포항", "제주", "안산", "안양",
].map((name, i) => ({ value: `city-${i}`, label: name }));

export function DevWave3Demos() {
  const [sSm, setSSm] = useState("a");
  const [sMd, setSMd] = useState("b");
  const [sLg, setSLg] = useState("c");
  const [sSearch, setSSearch] = useState("");
  const [sErr, setSErr] = useState("");
  const [sDis] = useState("a");
  const [sLh, setSLh] = useState("a");
  const [sFull, setSFull] = useState("");
  const [sWithDis, setSWithDis] = useState("a");

  const [taSm, setTaSm] = useState("");
  const [taMd, setTaMd] = useState("");
  const [taLg, setTaLg] = useState("");
  const [taAuto, setTaAuto] = useState("한 줄씩 늘어납니다.\n".repeat(3).trim());
  const [taCount, setTaCount] = useState("");
  const [taErr, setTaErr] = useState("x");
  const [taLh, setTaLh] = useState("");
  const [taNorm, setTaNorm] = useState("고정 높이");

  const [cDef, setCDef] = useState(false);
  const [cDan, setCDan] = useState(false);
  const [cAsync, setCAsync] = useState(false);
  const [cNode, setCNode] = useState(false);

  return (
    <>
      <section className={d.section}>
        <h2 className={d.h2}>PcSelect</h2>
        <p className={d.note}>size (sm / md / lg)</p>
        <div className={d.row}>
          <div className={d.demoSelectSm}>
            <PcSelect label="Small" size="sm" value={sSm} onChange={setSSm} options={BASE_ENABLED} />
          </div>
          <div className={d.demoSelectSm}>
            <PcSelect label="Medium" size="md" value={sMd} onChange={setSMd} options={BASE_ENABLED} />
          </div>
          <div className={d.demoSelectSm}>
            <PcSelect label="Large" size="lg" value={sLg} onChange={setSLg} options={BASE_ENABLED} />
          </div>
        </div>
        <p className={d.note}>비활성 옵션 포함</p>
        <div className={d.demoSelectSm}>
          <PcSelect
            label="목록에 비활성 항목"
            value={sWithDis}
            onChange={setSWithDis}
            options={BASE_OPTIONS}
          />
        </div>
        <p className={d.note}>searchable (한국 도시)</p>
        <div className={d.demoSelectMd}>
          <PcSelect
            label="도시 검색"
            value={sSearch}
            onChange={setSSearch}
            options={KOREA_CITIES}
            searchable
            placeholder="도시를 선택하세요"
          />
        </div>
        <p className={d.note}>error</p>
        <div className={d.demoSelectSm}>
          <PcSelect
            label="필수"
            value={sErr}
            onChange={setSErr}
            options={BASE_ENABLED}
            error="값을 선택해야 합니다."
          />
        </div>
        <p className={d.note}>disabled</p>
        <div className={d.demoSelectSm}>
          <PcSelect
            label="비활성"
            value={sDis}
            onChange={() => {}}
            options={BASE_ENABLED}
            disabled
          />
        </div>
        <p className={d.note}>label + helperText</p>
        <div className={d.demoSelectSm}>
          <PcSelect
            label="분류"
            helperText="목록에서 하나만 선택할 수 있습니다."
            value={sLh}
            onChange={setSLh}
            options={BASE_ENABLED}
          />
        </div>
        <p className={d.note}>fullWidth</p>
        <div className={d.full}>
          <PcSelect label="전체 너비" fullWidth value={sFull} onChange={setSFull} options={BASE_ENABLED} />
        </div>
      </section>

      <section className={d.section}>
        <h2 className={d.h2}>PcTextarea</h2>
        <p className={d.note}>size</p>
        <div className={d.row}>
          <div className={d.demoSelectSm}>
            <PcTextarea label="sm" size="sm" value={taSm} onChange={(e) => setTaSm(e.target.value)} />
          </div>
          <div className={d.demoSelectSm}>
            <PcTextarea label="md" size="md" value={taMd} onChange={(e) => setTaMd(e.target.value)} />
          </div>
          <div className={d.demoSelectSm}>
            <PcTextarea label="lg" size="lg" value={taLg} onChange={(e) => setTaLg(e.target.value)} />
          </div>
        </div>
        <p className={d.note}>autoResize</p>
        <div className={d.demoSelectMd}>
          <PcTextarea
            label="자동 높이"
            value={taAuto}
            onChange={(e) => setTaAuto(e.target.value)}
            autoResize
          />
        </div>
        <p className={d.note}>showCount + maxLength=200</p>
        <div className={d.demoSelectMd}>
          <PcTextarea
            label="글자 수"
            value={taCount}
            onChange={(e) => setTaCount(e.target.value)}
            showCount
            maxLength={200}
          />
        </div>
        <p className={d.note}>error</p>
        <div className={d.demoSelectMd}>
          <PcTextarea
            label="검증"
            value={taErr}
            onChange={(e) => setTaErr(e.target.value)}
            error="한 글자 이상 입력하세요."
          />
        </div>
        <p className={d.note}>label + helperText</p>
        <div className={d.demoSelectMd}>
          <PcTextarea
            label="메모"
            helperText="내부 공유용입니다."
            value={taLh}
            onChange={(e) => setTaLh(e.target.value)}
          />
        </div>
        <p className={d.note}>일반 vs autoResize</p>
        <div className={d.row}>
          <div className={d.demoSelectSm}>
            <PcTextarea label="일반 (resize 세로)" value={taNorm} onChange={(e) => setTaNorm(e.target.value)} />
          </div>
          <div className={d.demoSelectSm}>
            <PcTextarea
              label="autoResize"
              value={taAuto}
              onChange={(e) => setTaAuto(e.target.value)}
              autoResize
            />
          </div>
        </div>
      </section>

      <section className={d.section}>
        <h2 className={d.h2}>PcConfirmDialog</h2>
        <div className={d.row}>
          <PcButton variant="secondary" onClick={() => setCDef(true)}>
            기본 확인
          </PcButton>
          <PcButton variant="danger" onClick={() => setCDan(true)}>
            위험 (삭제)
          </PcButton>
          <PcButton variant="primary" onClick={() => setCAsync(true)}>
            비동기 1.5초
          </PcButton>
          <PcButton variant="secondary" onClick={() => setCNode(true)}>
            ReactNode 메시지
          </PcButton>
        </div>

        <PcConfirmDialog
          open={cDef}
          onClose={() => setCDef(false)}
          onConfirm={() => {}}
          title="기본 확인"
          message="이 작업을 진행할까요?"
        />

        <PcConfirmDialog
          open={cDan}
          onClose={() => setCDan(false)}
          onConfirm={() => {}}
          title="항목 삭제"
          message="삭제 후에는 복구할 수 없습니다."
          variant="danger"
          confirmText="삭제"
        />

        <PcConfirmDialog
          open={cAsync}
          onClose={() => setCAsync(false)}
          onConfirm={async () => {
            await new Promise<void>((r) => {
              setTimeout(r, 1500);
            });
          }}
          title="처리 중"
          message="잠시만 기다려 주세요. 완료되면 창이 닫힙니다."
          confirmText="시작"
        />

        <PcConfirmDialog
          open={cNode}
          onClose={() => setCNode(false)}
          onConfirm={() => {}}
          title="복합 메시지"
          message={
            <div className={d.confirmMsg}>
              <p>첫 번째 단락입니다.</p>
              <p>두 번째 단락입니다.</p>
            </div>
          }
        />
      </section>
    </>
  );
}

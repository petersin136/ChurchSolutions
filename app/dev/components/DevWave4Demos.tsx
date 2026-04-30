"use client";

import { addDays } from "date-fns/addDays";
import { startOfDay } from "date-fns/startOfDay";
import { useState } from "react";
import { PcButton, PcDatePicker, usePcToast } from "@/components/ui";
import d from "./DevComponents.module.css";

export function DevWave4Demos() {
  const toast = usePcToast();

  const [dSm, setDSm] = useState<Date | null>(null);
  const [dMd, setDMd] = useState<Date | null>(new Date());
  const [dLg, setDLg] = useState<Date | null>(null);
  const [dLh, setDLh] = useState<Date | null>(null);
  const [dErr, setDErr] = useState<Date | null>(null);
  const [dDis] = useState<Date | null>(new Date());
  const [dRange, setDRange] = useState<Date | null>(null);
  const [dNoClear, setDNoClear] = useState<Date | null>(new Date());
  const [dFmt, setDFmt] = useState<Date | null>(new Date());

  const today = startOfDay(new Date());
  const maxRange = addDays(today, 30);

  return (
    <>
      <section className={d.section}>
        <h2 className={d.h2}>PcDatePicker</h2>
        <p className={d.note}>size (sm / md / lg)</p>
        <div className={d.row}>
          <div className={d.demoSelectSm}>
            <PcDatePicker label="sm" size="sm" value={dSm} onChange={setDSm} />
          </div>
          <div className={d.demoSelectSm}>
            <PcDatePicker label="md" size="md" value={dMd} onChange={setDMd} />
          </div>
          <div className={d.demoSelectSm}>
            <PcDatePicker label="lg" size="lg" value={dLg} onChange={setDLg} />
          </div>
        </div>
        <p className={d.note}>label + helperText</p>
        <div className={d.demoSelectMd}>
          <PcDatePicker
            label="행사일"
            helperText="달력에서 날짜를 고르세요."
            value={dLh}
            onChange={setDLh}
          />
        </div>
        <p className={d.note}>error</p>
        <div className={d.demoSelectMd}>
          <PcDatePicker
            label="필수"
            value={dErr}
            onChange={setDErr}
            error="날짜를 선택해야 합니다."
          />
        </div>
        <p className={d.note}>disabled</p>
        <div className={d.demoSelectMd}>
          <PcDatePicker label="비활성" value={dDis} onChange={() => {}} disabled />
        </div>
        <p className={d.note}>minDate=오늘, maxDate=오늘+30일</p>
        <div className={d.demoSelectMd}>
          <PcDatePicker
            label="범위"
            value={dRange}
            onChange={setDRange}
            minDate={today}
            maxDate={maxRange}
          />
        </div>
        <p className={d.note}>clearable=false</p>
        <div className={d.demoSelectMd}>
          <PcDatePicker
            label="지우기 비활성"
            value={dNoClear}
            onChange={setDNoClear}
            clearable={false}
          />
        </div>
        <p className={d.note}>format 한글</p>
        <div className={d.demoSelectMd}>
          <PcDatePicker
            label="표시 형식"
            value={dFmt}
            onChange={setDFmt}
            format="yyyy년 MM월 dd일"
          />
        </div>
      </section>

      <section className={d.section}>
        <h2 className={d.h2}>PcToast</h2>
        <div className={d.row}>
          <PcButton size="sm" variant="secondary" onClick={() => toast.success("저장되었습니다")}>
            success (제목만)
          </PcButton>
          <PcButton
            size="sm"
            variant="secondary"
            onClick={() => toast.error("실패", "네트워크를 확인해 주세요.")}
          >
            error + 설명
          </PcButton>
          <PcButton size="sm" variant="secondary" onClick={() => toast.info("알림", "곧 반영됩니다.")}>
            info
          </PcButton>
          <PcButton size="sm" variant="secondary" onClick={() => toast.warning("주의", "한도에 근접했습니다.")}>
            warning
          </PcButton>
          <PcButton
            size="sm"
            variant="secondary"
            onClick={() => toast.info("수동 닫기", "자동으로 닫히지 않습니다.", { duration: 0 })}
          >
            duration=0
          </PcButton>
          <PcButton
            size="sm"
            variant="primary"
            onClick={() => {
              for (let i = 1; i <= 5; i++) {
                toast.show({ variant: "info", title: `연속 ${i}/5` });
              }
            }}
          >
            5연속 (최대 3개)
          </PcButton>
          <PcButton size="sm" variant="ghost" onClick={() => toast.dismissAll()}>
            dismissAll
          </PcButton>
        </div>
      </section>
    </>
  );
}

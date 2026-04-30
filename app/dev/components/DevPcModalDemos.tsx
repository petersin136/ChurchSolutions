"use client";

import { useState } from "react";
import { PcButton, PcModal } from "@/components/ui";
import d from "./DevComponents.module.css";

const LOREM_PARAS = Array.from(
  { length: 30 },
  (_, i) =>
    `${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
);

export function DevPcModalDemos() {
  const [sizeSm, setSizeSm] = useState(false);
  const [sizeMd, setSizeMd] = useState(false);
  const [sizeLg, setSizeLg] = useState(false);
  const [sizeXl, setSizeXl] = useState(false);
  const [sizeFull, setSizeFull] = useState(false);
  const [basic, setBasic] = useState(false);
  const [withFooter, setWithFooter] = useState(false);
  const [longContent, setLongContent] = useState(false);
  const [hideX, setHideX] = useState(false);
  const [noOverlayClose, setNoOverlayClose] = useState(false);

  return (
    <section className={d.section}>
      <h2 className={d.h2}>PcModal</h2>
      <p className={d.note}>사이즈</p>
      <div className={d.row}>
        <PcButton size="sm" variant="secondary" onClick={() => setSizeSm(true)}>
          sm (400px)
        </PcButton>
        <PcButton size="sm" variant="secondary" onClick={() => setSizeMd(true)}>
          md (560px)
        </PcButton>
        <PcButton size="sm" variant="secondary" onClick={() => setSizeLg(true)}>
          lg (800px)
        </PcButton>
        <PcButton size="sm" variant="secondary" onClick={() => setSizeXl(true)}>
          xl (1100px)
        </PcButton>
        <PcButton size="sm" variant="secondary" onClick={() => setSizeFull(true)}>
          full (95vw)
        </PcButton>
      </div>
      <p className={d.note}>시나리오</p>
      <div className={d.row}>
        <PcButton size="sm" variant="primary" onClick={() => setBasic(true)}>
          기본
        </PcButton>
        <PcButton size="sm" variant="primary" onClick={() => setWithFooter(true)}>
          푸터 있음
        </PcButton>
        <PcButton size="sm" variant="primary" onClick={() => setLongContent(true)}>
          긴 내용
        </PcButton>
        <PcButton size="sm" variant="primary" onClick={() => setHideX(true)}>
          닫기 버튼 숨김
        </PcButton>
        <PcButton size="sm" variant="primary" onClick={() => setNoOverlayClose(true)}>
          오버레이 클릭 비활성
        </PcButton>
      </div>

      <PcModal open={sizeSm} onClose={() => setSizeSm(false)} title="sm" size="sm">
        <p className={d.muted}>max-width sm</p>
      </PcModal>
      <PcModal open={sizeMd} onClose={() => setSizeMd(false)} title="md" size="md">
        <p className={d.muted}>max-width md (기본)</p>
      </PcModal>
      <PcModal open={sizeLg} onClose={() => setSizeLg(false)} title="lg" size="lg">
        <p className={d.muted}>max-width lg</p>
      </PcModal>
      <PcModal open={sizeXl} onClose={() => setSizeXl(false)} title="xl" size="xl">
        <p className={d.muted}>max-width xl</p>
      </PcModal>
      <PcModal open={sizeFull} onClose={() => setSizeFull(false)} title="full" size="full">
        <p className={d.muted}>width 95vw</p>
      </PcModal>

      <PcModal open={basic} onClose={() => setBasic(false)} title="기본 모달">
        <p className={d.muted}>제목·본문·닫기(X)·ESC·오버레이 클릭으로 닫을 수 있습니다.</p>
      </PcModal>

      <PcModal
        open={withFooter}
        onClose={() => setWithFooter(false)}
        title="푸터"
        description="취소 또는 확인을 선택하세요."
        footer={
          <>
            <PcButton variant="ghost" onClick={() => setWithFooter(false)}>
              취소
            </PcButton>
            <PcButton variant="primary" onClick={() => setWithFooter(false)}>
              확인
            </PcButton>
          </>
        }
      >
        <p className={d.muted}>footer 슬롯에 버튼 두 개.</p>
      </PcModal>

      <PcModal open={longContent} onClose={() => setLongContent(false)} title="긴 본문" size="md">
        {LOREM_PARAS.map((line, i) => (
          <p key={i} className={`${d.muted} ${d.modalDemoPara}`}>
            {line}
          </p>
        ))}
      </PcModal>

      <PcModal
        open={hideX}
        onClose={() => setHideX(false)}
        title="닫기 버튼 숨김"
        description="ESC 또는 아래 버튼으로만 닫을 수 있습니다."
        hideCloseButton
        footer={
          <PcButton variant="primary" onClick={() => setHideX(false)}>
            닫기
          </PcButton>
        }
      >
        <p className={d.muted}>hideCloseButton=true</p>
      </PcModal>

      <PcModal
        open={noOverlayClose}
        onClose={() => setNoOverlayClose(false)}
        title="오버레이 클릭 비활성"
        description="배경을 눌러도 닫히지 않습니다. X 또는 ESC를 사용하세요."
        closeOnOverlayClick={false}
      >
        <p className={d.muted}>closeOnOverlayClick=false</p>
      </PcModal>
    </section>
  );
}

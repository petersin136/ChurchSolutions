import { Inbox, Search } from "lucide-react";
import {
  PcAvatar,
  PcBadge,
  PcButton,
  PcCard,
  PcEmptyState,
  PcInput,
} from "@/components/ui";
import d from "./DevComponents.module.css";
import { DevPcModalDemos } from "./DevPcModalDemos";
import { DevWave3Demos } from "./DevWave3Demos";
import { DevWave4Demos } from "./DevWave4Demos";
import { DevWave5Demos } from "./DevWave5Demos";

const BTN_VARIANTS = [
  "primary",
  "secondary",
  "danger",
  "ghost",
  "link",
] as const;
const BTN_SIZES = ["sm", "md", "lg"] as const;

const BADGE_VARIANTS = [
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
  "teal",
  "gray",
] as const;
const BADGE_SIZES = ["sm", "md"] as const;

const KO_NAMES = ["김목사", "이은혜", "박교사", "최집사", "정새가족"];
const EN_NAMES = [
  "John Smith",
  "Mary Jane Watson",
  "Robert Downey",
  "Alice Cooper",
  "James Earl Carter",
];

export default function DevComponentsPage() {
  return (
    <main className={d.page}>
      <div className={d.container}>
        <section className={d.section}>
          <h2 className={d.h2}>PcButton</h2>
          <p className={d.note}>variant × size</p>
          <div className={`${d.grid} ${d.gridBtn}`}>
            {BTN_VARIANTS.flatMap((variant) =>
              BTN_SIZES.map((size) => (
                <PcButton key={`${variant}-${size}`} variant={variant} size={size}>
                  {variant} / {size}
                </PcButton>
              )),
            )}
          </div>
          <p className={d.note}>leftIcon / rightIcon</p>
          <div className={d.row}>
            <PcButton leftIcon={<Search size={16} />}>검색</PcButton>
            <PcButton rightIcon={<Search size={16} />}>다음</PcButton>
            <PcButton
              leftIcon={<Search size={16} />}
              rightIcon={<Search size={16} />}
              variant="secondary"
            >
              양쪽
            </PcButton>
          </div>
          <p className={d.note}>loading / disabled</p>
          <div className={d.row}>
            <PcButton loading>로딩</PcButton>
            <PcButton disabled>비활성</PcButton>
            <PcButton variant="danger" loading>
              삭제 중
            </PcButton>
          </div>
          <p className={d.note}>fullWidth</p>
          <div className={d.full}>
            <PcButton fullWidth variant="primary">
              전체 너비
            </PcButton>
          </div>
        </section>

        <section className={d.section}>
          <h2 className={d.h2}>PcBadge</h2>
          <p className={d.note}>variant × size</p>
          <div className={d.row}>
            {BADGE_VARIANTS.flatMap((variant) =>
              BADGE_SIZES.map((size) => (
                <PcBadge key={`${variant}-${size}`} variant={variant} size={size}>
                  {variant}
                </PcBadge>
              )),
            )}
          </div>
          <p className={d.note}>텍스트 길이</p>
          <div className={d.rowTight}>
            <PcBadge variant="blue">길</PcBadge>
            <PcBadge variant="green">짧은</PcBadge>
            <PcBadge variant="yellow" size="sm">
              매우 긴 라벨 텍스트 예시입니다
            </PcBadge>
          </div>
        </section>

        <section className={d.section}>
          <h2 className={d.h2}>PcCard</h2>
          <div className={d.row}>
            <PcCard />
            <PcCard title="제목만" />
            <PcCard title="제목" subtitle="부제목입니다" />
            <PcCard
              title="액션"
              actions={
                <PcButton size="sm" variant="secondary">
                  설정
                </PcButton>
              }
            >
              본문 영역
            </PcCard>
          </div>
          <p className={d.note}>padding / elevation</p>
          <div className={d.row}>
            <PcCard title="sm / none" padding="sm" elevation="none">
              padding sm, elevation none
            </PcCard>
            <PcCard title="md / sm" padding="md" elevation="sm">
              기본에 가까운 카드
            </PcCard>
            <PcCard title="lg / md" padding="lg" elevation="md">
              여유 있는 패딩과 그림자
            </PcCard>
          </div>
          <p className={d.note}>본문 조합</p>
          <div className={d.row}>
            <PcCard title="텍스트만">
              <p className={d.muted}>단순 설명 문단입니다.</p>
            </PcCard>
            <PcCard title="버튼 포함">
              <PcButton size="sm">확인</PcButton>
            </PcCard>
            <div className={d.cardNest}>
              <PcCard title="중첩 카드">
                <PcCard padding="sm" elevation="none" divider={false}>
                  안쪽 카드
                </PcCard>
              </PcCard>
            </div>
          </div>
        </section>

        <section className={d.section}>
          <h2 className={d.h2}>PcAvatar</h2>
          <p className={d.note}>size × shape (이미지)</p>
          <div className={d.avatarGrid}>
            {(["sm", "md", "lg", "xl"] as const).flatMap((size) =>
              (["rounded", "circle"] as const).map((shape) => (
                <div key={`${size}-${shape}`} className={d.avatarCell}>
                  <PcAvatar
                    src="/icons/icon-192x192.png"
                    name="데모"
                    size={size}
                    shape={shape}
                  />
                  <span>
                    {size} / {shape}
                  </span>
                </div>
              )),
            )}
          </div>
          <p className={d.note}>이니셜 — 한국어 이름</p>
          <div className={d.row}>
            {KO_NAMES.map((name) => (
              <PcAvatar key={name} name={name} size="lg" />
            ))}
          </div>
          <p className={d.note}>이니셜 — 영어 이름</p>
          <div className={d.row}>
            {EN_NAMES.map((name) => (
              <PcAvatar key={name} name={name} size="lg" shape="circle" />
            ))}
          </div>
        </section>

        <section className={d.section}>
          <h2 className={d.h2}>PcInput</h2>
          <div className={d.stack}>
            <PcInput label="기본" placeholder="입력하세요" helperText="도움말입니다." />
            <PcInput
              label="에러"
              defaultValue="잘못된 값"
              error="형식이 올바르지 않습니다."
            />
            <PcInput
              label="접두·접미"
              prefix={<Search size={14} />}
              suffix="원"
              placeholder="0"
            />
            <PcInput label="small" size="sm" placeholder="sm" />
            <PcInput label="medium" size="md" placeholder="md" />
            <PcInput label="large" size="lg" placeholder="lg" />
            <PcInput label="비활성" disabled placeholder="입력 불가" />
          </div>
        </section>

        <section className={d.section}>
          <h2 className={d.h2}>PcEmptyState</h2>
          <div className={d.row}>
            <PcCard padding="sm" elevation="none">
              <PcEmptyState title="제목만" />
            </PcCard>
            <PcCard padding="sm" elevation="none">
              <PcEmptyState
                icon={<Inbox aria-hidden />}
                title="데이터 없음"
                description="아직 등록된 항목이 없습니다. 새로 추가해 보세요."
                action={<PcButton size="sm">추가</PcButton>}
              />
            </PcCard>
          </div>
          <div className={`${d.row} ${d.rowGapTop}`}>
            <PcCard padding="sm" elevation="none">
              <PcEmptyState
                icon={<Search aria-hidden />}
                title="검색 결과 없음"
                description="다른 키워드로 검색해 보세요."
                action={
                  <PcButton variant="ghost" size="sm">
                    필터 초기화
                  </PcButton>
                }
              />
            </PcCard>
            <PcCard padding="sm" elevation="none">
              <PcEmptyState
                title="데이터 없음"
                description="표시할 내용이 없습니다."
              />
            </PcCard>
          </div>
        </section>

        <DevPcModalDemos />
        <DevWave3Demos />
        <DevWave4Demos />
        <DevWave5Demos />
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AuthCardShell } from "@/components/auth/AuthCardShell";
import { PcModal } from "@/components/ui/PcModal";
import styles from "./ChurchSearchPage.module.css";

export interface ChurchSearchItem {
  id: string;
  name: string;
  pastor: string;
  address: string;
}

const DUMMY_CHURCHES: ChurchSearchItem[] = [
  {
    id: "1",
    name: "샘플교회",
    pastor: "김은혜",
    address: "서울특별시 강남구 테헤란로 123",
  },
  {
    id: "2",
    name: "은혜교회",
    pastor: "이요한",
    address: "경기도 성남시 분당구 정자로 45",
  },
  {
    id: "3",
    name: "사랑의교회",
    pastor: "박믿음",
    address: "인천광역시 남동구 구월로 78",
  },
  {
    id: "4",
    name: "새벽별교회",
    pastor: "최소망",
    address: "부산광역시 해운대구 센텀로 210",
  },
];

function filterChurches(query: string): ChurchSearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DUMMY_CHURCHES.filter(
    (church) =>
      church.name.toLowerCase().includes(q) ||
      church.pastor.toLowerCase().includes(q) ||
      church.address.toLowerCase().includes(q),
  );
}

export default function ChurchSearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSelectedId, setModalSelectedId] = useState<string | null>(null);

  const isExampleMode = !hasSearched;

  const listItems = useMemo(
    () => (isExampleMode ? DUMMY_CHURCHES : filterChurches(submittedQuery)),
    [isExampleMode, submittedQuery],
  );

  const selectedChurch = useMemo(
    () =>
      DUMMY_CHURCHES.find((church) => church.id === selectedId) ??
      listItems.find((church) => church.id === selectedId) ??
      null,
    [listItems, selectedId],
  );

  useEffect(() => {
    setSelectedId(null);
    setModalSelectedId(null);
  }, [submittedQuery, hasSearched]);

  const runSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
    setHasSearched(true);
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setHasSearched(false);
      setSubmittedQuery("");
      setSelectedId(null);
      setModalSelectedId(null);
      setModalOpen(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  useEffect(() => {
    if (hasSearched && listItems.length > 0) {
      setModalOpen(true);
      setModalSelectedId(null);
    }
  }, [hasSearched, submittedQuery, listItems.length]);

  const openListModal = () => {
    setModalSelectedId(selectedId);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setModalSelectedId(selectedId);
  };

  const handleModalConfirm = () => {
    if (!modalSelectedId) return;
    setSelectedId(modalSelectedId);
    setModalOpen(false);
  };

  const handleApply = () => {
    if (!selectedChurch) return;
    console.log("교회 신청:", selectedChurch);
  };

  const handleCreateChurch = () => {
    console.log("교회 개설");
  };

  const showEmpty = hasSearched && listItems.length === 0;
  const showList = !showEmpty && listItems.length > 0;
  const step = selectedChurch ? 3 : hasSearched || selectedId ? 2 : 1;

  const modalTitle = isExampleMode ? "등록된 교회 예시" : "검색 결과";

  const footer = (
    <footer className={styles.footer}>
      <p className={styles.footerText}>찾으시는 교회가 없나요?</p>
      <button type="button" className={styles.footerLink} onClick={handleCreateChurch}>
        교회 개설하기
      </button>
    </footer>
  );

  return (
    <>
      <AuthCardShell footer={footer} lockBodyScroll>
        <header className={styles.header}>
          <h1 className={styles.title}>교회 찾기</h1>
          <p className={styles.subtitle}>
            소속된 교회를 검색해 신청하거나, 새로 개설할 수 있어요
          </p>
        </header>

        <ol className={styles.steps} aria-label="진행 단계">
          <li className={step >= 1 ? styles.stepActive : undefined}>① 교회 검색</li>
          <li className={step >= 2 ? styles.stepActive : undefined}>② 교회 선택</li>
          <li className={step >= 3 ? styles.stepActive : undefined}>③ 신청</li>
        </ol>

        <form className={styles.searchForm} onSubmit={handleSearchSubmit} noValidate>
          <div className={styles.searchRow}>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon} aria-hidden>
                <Search size={18} strokeWidth={2} />
              </span>
              <input
                className={styles.input}
                type="search"
                placeholder="교회명을 입력하세요"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                aria-label="교회명 검색"
              />
            </div>
            <button type="submit" className={styles.btnSearch}>
              검색
            </button>
          </div>
        </form>

        {showEmpty ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>검색 결과가 없어요</h2>
            <p className={styles.emptyDesc}>
              찾으시는 교회가 목록에 없다면 직접 개설할 수 있어요.
            </p>
            <div className={styles.emptyAction}>
              <button type="button" className={styles.btnPrimary} onClick={handleCreateChurch}>
                교회 개설
              </button>
            </div>
          </div>
        ) : null}

        {showList ? (
          <div className={styles.pickSection}>
            {selectedChurch ? (
              <div className={styles.selectedCard}>
                <p className={styles.selectedLabel}>선택한 교회</p>
                <p className={styles.selectedName}>{selectedChurch.name}</p>
                <p className={styles.selectedMeta}>
                  담임목사 {selectedChurch.pastor}
                </p>
              </div>
            ) : (
              <p className={styles.pickHint}>
                {isExampleMode
                  ? "교회명을 검색하거나, 등록된 교회 예시에서 선택할 수 있어요."
                  : "검색 결과에서 교회를 선택해 주세요."}
              </p>
            )}

            <button type="button" className={styles.btnOutline} onClick={openListModal}>
              {isExampleMode
                ? "등록된 교회 예시 보기"
                : `검색 결과 ${listItems.length}건 보기`}
            </button>

            <div className={styles.applyBar}>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!selectedChurch}
                onClick={handleApply}
              >
                이 교회로 신청하기
              </button>
            </div>
          </div>
        ) : null}
      </AuthCardShell>

      <PcModal
        open={modalOpen && showList}
        onClose={handleModalClose}
        title={modalTitle}
        description="소속 교회를 선택해 주세요."
        size="md"
        footer={
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnModalSecondary} onClick={handleModalClose}>
              취소
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!modalSelectedId}
              onClick={handleModalConfirm}
            >
              선택 완료
            </button>
          </div>
        }
      >
        <div className={styles.modalList} role="listbox" aria-label={modalTitle}>
          {listItems.map((church) => {
            const selected = church.id === modalSelectedId;
            return (
              <button
                key={church.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={[styles.resultCard, selected ? styles.resultCardSelected : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setModalSelectedId(church.id)}
              >
                <h2 className={styles.churchName}>{church.name}</h2>
                <p className={styles.meta}>담임목사 {church.pastor}</p>
                <p className={styles.meta}>{church.address}</p>
              </button>
            );
          })}
        </div>
      </PcModal>
    </>
  );
}

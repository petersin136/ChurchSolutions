"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AuthCardShell } from "@/components/auth/AuthCardShell";
import { PcModal } from "@/components/ui/PcModal";
import { useAuth } from "@/contexts/AuthContext";
import { CreatingSplash } from "@/components/common/CreatingSplash";
import { supabase } from "@/lib/supabase";
import styles from "./ChurchSearchPage.module.css";

export interface ChurchSearchItem {
  id: string;
  name: string;
}

export default function ChurchSearchPage() {
  const { session, refreshChurch, signOut } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<ChurchSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSelectedId, setModalSelectedId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [newChurchName, setNewChurchName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedChurch = useMemo(
    () => results.find((church) => church.id === selectedId) ?? null,
    [results, selectedId],
  );

  useEffect(() => {
    setSelectedId(null);
    setModalSelectedId(null);
  }, [submittedQuery, hasSearched]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (!supabase) {
      setSearchError("서버 연결에 실패했습니다.");
      return;
    }

    setSubmittedQuery(trimmed);
    setHasSearched(true);
    setSearchLoading(true);
    setSearchError(null);

    const { data, error } = await supabase
      .from("churches")
      .select("id, name")
      .ilike("name", `%${trimmed}%`)
      .limit(20);

    setSearchLoading(false);

    if (error) {
      setResults([]);
      setSearchError("검색에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    setResults((data as ChurchSearchItem[]) ?? []);
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setHasSearched(false);
      setSubmittedQuery("");
      setResults([]);
      setSearchLoading(false);
      setSearchError(null);
      setSelectedId(null);
      setModalSelectedId(null);
      setModalOpen(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch();
  };

  useEffect(() => {
    if (hasSearched && !searchLoading && results.length > 0) {
      setModalOpen(true);
      setModalSelectedId(null);
    }
  }, [hasSearched, submittedQuery, searchLoading, results.length]);

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
    const prefill = submittedQuery.trim() || query.trim();
    if (prefill && !newChurchName.trim()) {
      setNewChurchName(prefill);
    }
    setCreateMode(true);
    setCreateError(null);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleCancelCreate = () => {
    setCreateMode(false);
    setNewChurchName("");
    setCreateError(null);
    setCreating(false);
  };

  const handleSubmitCreate = async () => {
    const trimmed = newChurchName.trim();
    if (!trimmed) {
      setCreateError("교회 이름을 입력해주세요.");
      return;
    }

    setCreateError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/church/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ churchName: trimmed }),
      });

      const result = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !result.ok) {
        setCreateError(result.error || "교회 개설에 실패했습니다.");
        setCreating(false);
        return;
      }

      await refreshChurch();
      router.push("/");
    } catch {
      setCreateError("교회 개설 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setCreating(false);
    }
  };

  const showEmpty = hasSearched && !searchLoading && results.length === 0;
  const showList = hasSearched && !searchLoading && results.length > 0;
  const step = selectedChurch ? 3 : hasSearched || selectedId ? 2 : 1;

  const footer = (
    <footer className={styles.footer}>
      <p className={styles.footerText}>찾으시는 교회가 없나요?</p>
      <button type="button" className={styles.footerLink} onClick={handleCreateChurch}>
        교회 개설하기
      </button>
      <button type="button" className={styles.footerLink} onClick={handleLogout}>
        다른 계정으로 로그인
      </button>
    </footer>
  );

  if (creating) {
    return <CreatingSplash />;
  }

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
            <button type="submit" className={styles.btnSearch} disabled={searchLoading}>
              {searchLoading ? "검색 중..." : "검색"}
            </button>
          </div>
        </form>

        {createMode ? (
          <div className={styles.pickSection}>
            <p className={styles.pickHint}>새로 개설할 교회 이름을 입력해 주세요.</p>
            <input
              className={styles.input}
              type="text"
              placeholder="개설할 교회 이름을 입력하세요"
              value={newChurchName}
              onChange={(e) => setNewChurchName(e.target.value)}
              disabled={creating}
              aria-label="개설할 교회 이름"
            />
            {createError ? (
              <p className={styles.emptyDesc} role="alert">
                {createError}
              </p>
            ) : null}
            <div className={styles.applyBar}>
              <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnModalSecondary}
                onClick={handleCancelCreate}
                disabled={creating}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void handleSubmitCreate()}
                disabled={creating}
              >
                {creating ? "개설 중..." : "개설하기"}
              </button>
              </div>
            </div>
          </div>
        ) : null}

        {!hasSearched && !searchLoading ? (
          <p className={styles.pickHint}>교회명을 검색해 주세요.</p>
        ) : null}

        {searchLoading ? (
          <p className={styles.pickHint}>검색 중...</p>
        ) : null}

        {searchError ? (
          <p className={styles.emptyDesc} role="alert">
            {searchError}
          </p>
        ) : null}

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
              </div>
            ) : (
              <p className={styles.pickHint}>검색 결과에서 교회를 선택해 주세요.</p>
            )}

            <button type="button" className={styles.btnOutline} onClick={openListModal}>
              {`검색 결과 ${results.length}건 보기`}
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
        title="검색 결과"
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
        <div className={styles.modalList} role="listbox" aria-label="검색 결과">
          {results.map((church) => {
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
              </button>
            );
          })}
        </div>
      </PcModal>
    </>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { PcInput } from "@/components/ui";
import {
  DEFAULT_SMALL_GROUP_TERM,
  SMALL_GROUP_TERM_EXAMPLES,
  displaySmallGroupTermInput,
  loadSmallGroupTerm,
  normalizeSmallGroupTerm,
  saveSmallGroupTerm,
} from "@/lib/smallGroupTerm";

export function SmallGroupTermField({
  churchId,
  onSaved,
}: {
  churchId: string | null;
  onSaved?: () => void;
}) {
  const [storedTerm, setStoredTerm] = useState("");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);
  const composingRef = useRef(false);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!churchId) return;
    const loaded = loadSmallGroupTerm(churchId);
    setStoredTerm(loaded);
    if (!focusedRef.current) {
      setDraft(displaySmallGroupTermInput(loaded));
    }
  }, [churchId]);

  const commit = (value: string) => {
    if (!churchId) return;
    const normalized = normalizeSmallGroupTerm(value);
    setDraft(displaySmallGroupTermInput(normalized));
    if (normalized !== storedTerm) {
      saveSmallGroupTerm(churchId, normalized);
      setStoredTerm(normalized);
      onSaved?.();
    }
  };

  return (
    <PcInput
      ref={inputRef}
      size="lg"
      label="소그룹 형태"
      value={draft}
      placeholder={DEFAULT_SMALL_GROUP_TERM}
      helperText={`예 ${SMALL_GROUP_TERM_EXAMPLES}`}
      onFocus={() => { focusedRef.current = true; }}
      onChange={(e) => setDraft(e.target.value)}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        setDraft(e.currentTarget.value);
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (skipBlurCommitRef.current) {
          skipBlurCommitRef.current = false;
          return;
        }
        window.setTimeout(() => {
          if (composingRef.current) return;
          commit(inputRef.current?.value ?? draft);
        }, 0);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        if (e.nativeEvent.isComposing || composingRef.current) return;
        e.preventDefault();
        skipBlurCommitRef.current = true;
        commit((e.currentTarget as HTMLInputElement).value);
        (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}

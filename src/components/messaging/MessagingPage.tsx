"use client";

import { useState, useCallback } from "react";
import type { DB } from "@/types/db";
import { SendMessage, type MessageLog } from "./SendMessage";
import { MessageHistory } from "./MessageHistory";
import { FrequentGroups, type FrequentGroup } from "./FrequentGroups";
import { MessagingSettings } from "./MessagingSettings";

const SUB_TABS = [
  { id: "send", label: "문자 발송" },
  { id: "history", label: "발송 내역" },
  { id: "frequent", label: "자주 보내는 명단" },
  { id: "settings", label: "설정" },
] as const;

export interface MessagingPageProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function MessagingPage({ db, toast }: MessagingPageProps) {
  const [subTab, setSubTab] = useState<(typeof SUB_TABS)[number]["id"]>("send");
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [frequentGroups, setFrequentGroups] = useState<FrequentGroup[]>([]);
  const [repPhone, setRepPhone] = useState("");
  const [signature, setSignature] = useState("");
  const [smsPriceDisplay, setSmsPriceDisplay] = useState("");

  const handleSend = useCallback((payload: Omit<MessageLog, "id" | "sent_at" | "status">) => {
    const log: MessageLog = {
      ...payload,
      id: `log-${Date.now()}`,
      sent_at: new Date().toISOString(),
      status: "저장됨",
    };
    setMessageLogs((prev) => [log, ...prev]);
    toast("발송 내역에 저장되었습니다. (실제 SMS 미연동)", "ok");
  }, [toast]);

  const handleSaveGroups = useCallback((groups: FrequentGroup[]) => {
    setFrequentGroups(groups);
  }, []);

  const handleSaveSettings = useCallback((data: { representativePhone: string; signature: string; smsPriceDisplay: string }) => {
    setRepPhone(data.representativePhone);
    setSignature(data.signature);
    setSmsPriceDisplay(data.smsPriceDisplay);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      <div className="flex border-b border-gray-200 bg-white px-2 overflow-x-auto">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              subTab === tab.id
                ? "border-[#1e3a5f] text-[#1e3a5f]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {subTab === "send" && (
          <SendMessage members={db.members ?? []} onSend={handleSend} />
        )}
        {subTab === "history" && <MessageHistory logs={messageLogs} />}
        {subTab === "frequent" && (
          <FrequentGroups groups={frequentGroups} onSave={handleSaveGroups} />
        )}
        {subTab === "settings" && (
          <MessagingSettings
            representativePhone={repPhone}
            signature={signature}
            smsPriceDisplay={smsPriceDisplay}
            onSave={handleSaveSettings}
            toast={toast}
          />
        )}
      </div>
    </div>
  );
}

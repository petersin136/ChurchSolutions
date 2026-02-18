"use client";

import { useState, useCallback } from "react";
import type { DB } from "@/types/db";
import { SendMessage, type MessageLog } from "./SendMessage";
import { MessageHistory } from "./MessageHistory";
import { FrequentGroups, type FrequentGroup } from "./FrequentGroups";
import { MessagingSettings } from "./MessagingSettings";
import { MessageSquare, History, Users, Settings } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";

type MessagingSubTab = "send" | "history" | "frequent" | "settings";

const PAGE_INFO: Record<MessagingSubTab, { title: string; desc: string }> = {
  send: { title: "문자 발송", desc: "수신자를 선택하고 메시지를 발송합니다" },
  history: { title: "발송 내역", desc: "발송한 문자 내역을 확인합니다" },
  frequent: { title: "자주 보내는 명단", desc: "자주 사용하는 수신자 명단을 관리합니다" },
  settings: { title: "설정", desc: "문자 발송 설정을 관리합니다" },
};

const NAV_SECTIONS = [
  {
    sectionLabel: "문자",
    items: [
      { id: "send" as const, label: "문자 발송", Icon: MessageSquare },
      { id: "history" as const, label: "발송 내역", Icon: History },
      { id: "frequent" as const, label: "자주 보내는 명단", Icon: Users },
      { id: "settings" as const, label: "설정", Icon: Settings },
    ],
  },
];

export interface MessagingPageProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function MessagingPage({ db, toast }: MessagingPageProps) {
  const [subTab, setSubTab] = useState<MessagingSubTab>("send");
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

  const info = PAGE_INFO[subTab];

  return (
    <UnifiedPageLayout
      pageTitle="문자"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={NAV_SECTIONS}
      activeId={subTab}
      onNav={(id) => setSubTab(id as MessagingSubTab)}
      versionText="문자 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      SidebarIcon={MessageSquare}
    >
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
    </UnifiedPageLayout>
  );
}

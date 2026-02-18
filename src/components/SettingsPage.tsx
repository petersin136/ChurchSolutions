"use client";

import { useRef, useState, useEffect } from "react";
import type { DB } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/utils/auditLog";
import type { Organization, OrganizationMember, Role, UserRole, CustomField, CustomLabel, AuditLog } from "@/types/db";
import { DEFAULT_SETTINGS } from "@/types/db";
import {
  OrganizationManagement,
  RoleManagement,
  UserManagement,
  CustomFieldSettings,
  CustomLabelSettings,
  AuditLogViewer,
} from "@/components/settings";
import { SealSettingsSection } from "@/components/finance/SealSettingsSection";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { Settings, Building2, Shield, Users, FileEdit, Tag, History, FileSignature } from "lucide-react";

type SettingsSubTab = "basic" | "organization" | "roles" | "users" | "customFields" | "customLabels" | "audit" | "receipt";

interface SettingsPageProps {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  saveDb?: (d: DB) => Promise<void>;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

const SETTINGS_TABS: { id: SettingsSubTab; label: string; Icon: React.ComponentType<any> }[] = [
  { id: "basic", label: "기본 설정", Icon: Settings },
  { id: "organization", label: "조직 관리", Icon: Building2 },
  { id: "roles", label: "역할/권한", Icon: Shield },
  { id: "users", label: "사용자 관리", Icon: Users },
  { id: "customFields", label: "커스텀 필드", Icon: FileEdit },
  { id: "customLabels", label: "명칭 설정", Icon: Tag },
  { id: "audit", label: "작업 이력", Icon: History },
  { id: "receipt", label: "기부금 영수증", Icon: FileSignature },
];

const SETTINGS_PAGE_INFO: Record<SettingsSubTab, { title: string; desc: string }> = {
  basic: { title: "기본 설정", desc: "교회 정보 및 데이터 관리" },
  organization: { title: "조직 관리", desc: "조직과 구성원을 관리합니다" },
  roles: { title: "역할/권한", desc: "역할과 권한을 설정합니다" },
  users: { title: "사용자 관리", desc: "사용자와 역할을 연결합니다" },
  customFields: { title: "커스텀 필드", desc: "성도 필드를 추가합니다" },
  customLabels: { title: "명칭 설정", desc: "화면 표시 명칭을 설정합니다" },
  audit: { title: "작업 이력", desc: "시스템 작업 이력을 확인합니다" },
  receipt: { title: "기부금 영수증", desc: "영수증 인장 및 설정" },
};

export function SettingsPage({
  db,
  setDb,
  save,
  saveDb,
  toast,
}: SettingsPageProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>("basic");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<(UserRole & { role?: Role; member?: import("@/types/db").Member })[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customLabels, setCustomLabels] = useState<CustomLabel[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const [orgRes, omRes, rolesRes, urRes, cfRes, clRes, auditRes] = await Promise.all([
        supabase.from("organizations").select("*").order("sort_order"),
        supabase.from("organization_members").select("*"),
        supabase.from("roles").select("*").order("sort_order"),
        supabase.from("user_roles").select("*, role:roles(*), member:members(*)"),
        supabase.from("custom_fields").select("*").order("sort_order"),
        supabase.from("custom_labels").select("*"),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      if (orgRes.data) setOrganizations((orgRes.data as Organization[]));
      if (omRes.data) setOrganizationMembers((omRes.data as OrganizationMember[]));
      if (rolesRes.data) setRoles((rolesRes.data as Role[]));
      if (urRes.data) setUserRoles((urRes.data as (UserRole & { role?: Role; member?: import("@/types/db").Member })[]));
      if (cfRes.data) setCustomFields((cfRes.data as CustomField[]));
      if (clRes.data) setCustomLabels((clRes.data as CustomLabel[]));
      if (auditRes.data) setAuditLogs((auditRes.data as AuditLog[]));
    })();
  }, []);

  function saveSettings(
    churchName: string,
    depts: string,
    fiscalStart: string
  ) {
    setDb((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        churchName,
        depts,
        fiscalStart,
      },
    }));
    save();
  }

  function exportBackup() {
    const json = JSON.stringify(db);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `superplanner_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("백업 파일이 다운로드되었습니다", "ok");
  }

  function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Partial<DB>;
        const merged = { ...db, ...parsed };
        setDb(() => merged);
        if (saveDb) saveDb(merged).then(() => toast("복원 완료", "ok")).catch(() => toast("저장 실패", "err"));
        else { save(); toast("복원 완료", "ok"); }
      } catch {
        toast("잘못된 백업 파일입니다", "err");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function clearAllData() {
    if (typeof window === "undefined") return;
    if (!window.confirm("정말 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    try {
      setResetLoading(true);
      if (saveDb) {
        const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "all" }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || res.statusText || "전체 초기화 요청 실패");
        }
      }
      const emptyDb: DB = {
        settings: { ...DEFAULT_SETTINGS },
        members: [],
        attendance: {},
        attendanceReasons: {},
        notes: {},
        plans: [],
        sermons: [],
        visits: [],
        income: [],
        expense: [],
        budget: {},
        checklist: {},
      };
      setDb(emptyDb);
      save();
      toast("전체 초기화 완료", "warn");
      window.location.reload();
    } catch (err) {
      console.error("전체 초기화 오류:", err);
      alert("초기화 중 오류가 발생했습니다.\n" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSave() {
    save();
    if (saveDb) {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(db.settings),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          toast("저장되었습니다", "ok");
          await logAction({ action: "UPDATE", targetTable: "settings", targetName: "기본설정" });
        } else throw new Error(data?.message || "저장 실패");
      } catch (e) {
        console.warn("설정 저장 실패:", e);
        toast("저장 실패", "err");
      }
    } else {
      toast("저장되었습니다", "ok");
      logAction({ action: "UPDATE", targetTable: "settings", targetName: "기본설정" });
    }
  }

  async function resetTab(name: "pastoral" | "finance" | "planner" | "visit" | "bulletin") {
    const msg =
      name === "pastoral" ? "목양(성도·출석·노트) 데이터를 초기화하시겠습니까?"
      : name === "finance" ? "재정(수입·지출·예산) 데이터를 초기화하시겠습니까?"
      : name === "planner" ? "플래너 데이터를 초기화하시겠습니까?"
      : name === "visit" ? "심방/상담 데이터를 초기화하시겠습니까?"
      : "주보 데이터를 초기화하시겠습니까?";
    if (typeof window === "undefined" || !window.confirm(msg)) return;

    try {
      setResetLoading(true);

      if (name === "pastoral") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "pastoral" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "목양 초기화 실패");
        }
        setDb((prev) => ({ ...prev, members: [], attendance: {}, attendanceReasons: {}, notes: {} }));
        save();
        toast("목양 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else if (name === "finance") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "finance" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "재정 초기화 실패");
        }
        setDb((prev) => ({ ...prev, income: [], expense: [], budget: {} }));
        save();
        toast("재정 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else if (name === "planner") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "planner" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "플래너 초기화 실패");
        }
        if (typeof window !== "undefined") window.localStorage.removeItem("planner_db");
        setDb((prev) => ({ ...prev, plans: [] }));
        save();
        toast("플래너 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else if (name === "visit") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "visits" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "심방 초기화 실패");
        }
        if (typeof window !== "undefined") window.localStorage.removeItem("visit_counsel_db");
        setDb((prev) => ({ ...prev, visits: [] }));
        save();
        toast("심방/상담 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else {
        if (typeof window !== "undefined") window.localStorage.removeItem("bulletin_db");
        toast("주보 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      }
    } catch (err) {
      console.error(`${name} 초기화 오류:`, err);
      alert("초기화 중 오류가 발생했습니다.\n" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetLoading(false);
    }
  }

  const navSections = [{ sectionLabel: "설정", items: SETTINGS_TABS.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon })) }];
  const info = SETTINGS_PAGE_INFO[settingsSubTab];

  return (
    <UnifiedPageLayout
      pageTitle="설정"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={navSections}
      activeId={settingsSubTab}
      onNav={(id) => setSettingsSubTab(id as SettingsSubTab)}
      versionText="설정 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      SidebarIcon={Settings}
    >
      {settingsSubTab === "organization" && (
        <OrganizationManagement
          organizations={organizations}
          organizationMembers={organizationMembers}
          members={db.members}
          onSaveOrganization={async (org) => {
            setOrganizations((prev) => (org.id ? prev.map((o) => (o.id === org.id ? { ...o, ...org } : o)) : [...prev, { ...org, id: `org-${Date.now()}`, name: org.name!, type: org.type!, sort_order: 0, is_active: true } as Organization]));
            toast("저장되었습니다", "ok");
          }}
          onDeleteOrganization={async (id) => {
            setOrganizations((prev) => prev.filter((o) => o.id !== id));
            setOrganizationMembers((prev) => prev.filter((om) => om.organization_id !== id));
            toast("삭제되었습니다", "ok");
          }}
          onAddMemberToOrg={async (organizationId, memberId, roleInOrg) => {
            setOrganizationMembers((prev) => [...prev, { id: `om-${Date.now()}`, organization_id: organizationId, member_id: memberId, role_in_org: roleInOrg, is_active: true } as OrganizationMember]);
            toast("추가되었습니다", "ok");
          }}
          onRemoveMemberFromOrg={async (organizationId, memberId) => {
            setOrganizationMembers((prev) => prev.filter((om) => !(om.organization_id === organizationId && om.member_id === memberId)));
            toast("제거되었습니다", "ok");
          }}
        />
      )}
      {settingsSubTab === "roles" && (
        <RoleManagement
          roles={roles.length > 0 ? roles : [
            { id: "r1", name: "담임목사", description: "모든 권한", permissions: { members: { read: true, write: true, delete: true }, finance: { read: true, write: true, delete: true }, attendance: { read: true, write: true, delete: true }, reports: { read: true }, settings: { read: true, write: true }, donation_receipt: { read: true, write: true } }, is_system: true, sort_order: 1 },
            { id: "r2", name: "일반성도", description: "읽기만", permissions: {}, is_system: true, sort_order: 2 },
          ]}
          onSaveRole={async (role) => {
            if (role.id) setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, ...role } : r)));
            else setRoles((prev) => [...prev, { ...role, id: `r-${Date.now()}`, name: role.name!, permissions: role.permissions ?? {}, is_system: false, sort_order: prev.length } as Role]);
            toast("저장되었습니다", "ok");
          }}
        />
      )}
      {settingsSubTab === "users" && (
        <UserManagement
          userRoles={userRoles}
          roles={roles.length > 0 ? roles : [{ id: "r1", name: "담임목사", permissions: {}, is_system: true, sort_order: 1 }]}
          members={db.members}
          onSaveUserRole={async (ur) => {
            if (ur.id) setUserRoles((prev) => prev.map((x) => (x.id === ur.id ? { ...x, ...ur } : x)));
            toast("저장되었습니다", "ok");
          }}
        />
      )}
      {settingsSubTab === "customFields" && (
        <CustomFieldSettings
          customFields={customFields}
          onSave={async (f) => {
            setCustomFields((prev) => (f.id ? prev.map((x) => (x.id === f.id ? { ...x, ...f } : x)) : [...prev, { ...f, id: `cf-${Date.now()}`, target_table: f.target_table!, field_name: f.field_name!, field_label: f.field_label!, field_type: f.field_type!, is_required: f.is_required ?? false, sort_order: prev.length, is_active: true } as CustomField]));
            toast("저장되었습니다", "ok");
          }}
        />
      )}
      {settingsSubTab === "customLabels" && (
        <CustomLabelSettings
          customLabels={customLabels}
          onSave={async (labels) => {
            setCustomLabels(labels.map((l, i) => ({ ...l, id: (customLabels[i]?.id) ?? `cl-${Date.now()}-${i}` })));
            toast("저장되었습니다", "ok");
          }}
        />
      )}
      {settingsSubTab === "audit" && (
        <AuditLogViewer logs={auditLogs} />
      )}
      {settingsSubTab === "receipt" && (
        <SealSettingsSection churchId={null} toast={toast} />
      )}

      {settingsSubTab === "basic" && (
      <>
      <div className="card card-body-padded">
        <div className="fg">
          <label className="fl">교회 이름</label>
          <input
            type="text"
            className="fi"
            placeholder="○○교회"
            value={db.settings.churchName ?? ""}
            onInput={(e) =>
              saveSettings(
                (e.target as HTMLInputElement).value,
                db.settings.depts,
                db.settings.fiscalStart
              )
            }
          />
        </div>
        <div className="fg">
          <label className="fl">부서 목록 (쉼표 구분)</label>
          <input
            type="text"
            className="fi"
            placeholder="유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부"
            value={db.settings.depts ?? ""}
            onInput={(e) =>
              saveSettings(
                db.settings.churchName,
                (e.target as HTMLInputElement).value,
                db.settings.fiscalStart
              )
            }
          />
        </div>
        <div className="fg">
          <label className="fl">회계연도 시작월</label>
          <select
            className="fs"
            value={db.settings.fiscalStart}
            onChange={(e) =>
              saveSettings(
                db.settings.churchName,
                db.settings.depts,
                e.target.value
              )
            }
          >
            <option value="1">1월</option>
            <option value="3">3월</option>
            <option value="9">9월</option>
          </select>
        </div>
        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginTop: 8, marginBottom: 4 }}>
          아래 항목은 필수가 아니며, 기부금 영수증 발행 시에만 사용됩니다. 비워두면 영수증에 &quot;-&quot;로 표시됩니다.
        </p>
        <div className="fg">
          <label className="fl">사업자등록번호 (고유번호)</label>
          <input
            type="text"
            className="fi"
            placeholder="000-00-00000 (선택)"
            value={db.settings.businessNumber ?? ""}
            onInput={(e) => {
              setDb((prev) => ({
                ...prev,
                settings: { ...prev.settings, businessNumber: (e.target as HTMLInputElement).value },
              }));
              save();
            }}
          />
        </div>
        <div className="fg">
          <label className="fl">소재지</label>
          <input
            type="text"
            className="fi"
            placeholder="서울시 강남구 ○○로 123 (선택)"
            value={db.settings.address ?? ""}
            onInput={(e) => {
              setDb((prev) => ({
                ...prev,
                settings: { ...prev.settings, address: (e.target as HTMLInputElement).value },
              }));
              save();
            }}
          />
        </div>
        <div className="fg">
          <label className="fl">담임목사</label>
          <input
            type="text"
            className="fi"
            placeholder="홍길동 목사 (선택)"
            value={db.settings.pastor ?? ""}
            onInput={(e) => {
              setDb((prev) => ({
                ...prev,
                settings: { ...prev.settings, pastor: (e.target as HTMLInputElement).value },
              }));
              save();
            }}
          />
        </div>
        <details style={{ marginTop: 12, marginBottom: 0 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text2)" }}>
            영수증 양식 참고 이미지 보기
          </summary>
          <div style={{ marginTop: 12, padding: 12, background: "var(--bg2)", borderRadius: 8 }}>
            <img
              src="/receipt-reference.png"
              alt="기부금 영수증 양식 참고"
              style={{ maxWidth: "100%", height: "auto", border: "1px solid var(--border)", borderRadius: 4 }}
            />
          </div>
        </details>
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>

      <div
        className="card card-body-padded"
        style={{ marginTop: 16 }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={exportBackup}>
            전체 백업
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => importRef.current?.click()}>
            백업 복원
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={importBackup}
          />
          <button type="button" className="btn btn-danger" onClick={() => clearAllData()} disabled={resetLoading}>
            {resetLoading ? "처리 중..." : "전체 초기화"}
          </button>
        </div>
      </div>

      <div className="card card-body-padded" style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>탭별 초기화</h4>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
          해당 탭의 데이터만 삭제됩니다. 복구할 수 없습니다.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { key: "pastoral" as const, label: "목양" },
            { key: "planner" as const, label: "플래너" },
            { key: "finance" as const, label: "재정" },
            { key: "visit" as const, label: "심방/상담" },
            { key: "bulletin" as const, label: "주보" },
          ].map(({ key, label }) => (
            <li
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "var(--bg2)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
              <button
                type="button"
                onClick={() => resetTab(key)}
                disabled={resetLoading}
                style={{
                  fontSize: 13,
                  padding: "6px 12px",
                  color: "var(--danger, #dc2626)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: resetLoading ? "not-allowed" : "pointer",
                  opacity: resetLoading ? 0.6 : 1,
                }}
              >
                초기화
              </button>
            </li>
          ))}
        </ul>
      </div>
      </>
      )}
    </UnifiedPageLayout>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import type { DB, Member, Family } from "@/types/db";
import { getDepts } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { CalendarDropdown } from "@/components/CalendarDropdown";

const ROLES = ["담임목사", "부목사", "전도사", "장로", "안수집사", "권사", "집사", "성도", "청년", "학생"];
const VISIT_PATHS: Member["visit_path"][] = ["지인소개", "전도", "자진방문", "이전교회", "기타"];
const FAMILY_RELATIONS: Member["family_relation"][] = ["본인", "배우자", "자녀", "부모", "형제", "기타"];
const BAPTISM_TYPES: Member["baptism_type"][] = ["유아세례", "세례", "입교", "미세례"];
const MEMBER_STATUSES: Member["member_status"][] = ["활동", "휴적", "은퇴", "별세", "이적", "제적", "미등록"];

function formatPhone(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
}

export interface MemberFormProps {
  db: DB;
  member: Member | null;
  onSaved: (member: Member) => void;
  onCancel: () => void;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function MemberForm({ db, member, onSaved, onCancel, toast }: MemberFormProps) {
  const depts = getDepts(db);
  const mokjangList = (db.settings.mokjangList || "").split(",").map((s) => s.trim()).filter(Boolean);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [job, setJob] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [dept, setDept] = useState("");
  const [role, setRole] = useState("");
  const [mokjang, setMokjang] = useState("");
  const [smallGroup, setSmallGroup] = useState("");
  const [talent, setTalent] = useState("");
  const [registeredDate, setRegisteredDate] = useState(new Date().toISOString().slice(0, 10));

  const [baptismType, setBaptismType] = useState<Member["baptism_type"] | "">("");
  const [baptismDate, setBaptismDate] = useState("");
  const [weddingAnniversary, setWeddingAnniversary] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [familyRelation, setFamilyRelation] = useState<Member["family_relation"] | "">("");
  const [familySearchOpen, setFamilySearchOpen] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [sameFamilyMembers, setSameFamilyMembers] = useState<Member[]>([]);

  const [isNewFamily, setIsNewFamily] = useState(false);
  const [firstVisitDate, setFirstVisitDate] = useState("");
  const [visitPath, setVisitPath] = useState<Member["visit_path"] | "">("");
  const [referrerId, setReferrerId] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerSearchOpen, setReferrerSearchOpen] = useState(false);
  const [referrerSearchQ, setReferrerSearchQ] = useState("");
  const [referrerCandidates, setReferrerCandidates] = useState<Member[]>([]);

  const [memberStatus, setMemberStatus] = useState<Member["member_status"]>("활동");
  const [statusReason, setStatusReason] = useState("");
  const [statusReasonModalOpen, setStatusReasonModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Member["member_status"] | null>(null);
  const [prayer, setPrayer] = useState("");
  const [memo, setMemo] = useState("");

  const [isProspect, setIsProspect] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const m = member;
    if (m) {
      setName(m.name || "");
      setGender(m.gender || "");
      setBirth(m.birth || "");
      setPhone(m.phone || "");
      setEmail(m.email || "");
      setAddress(m.address || "");
      setJob(m.job || "");
      setPhotoPreview(m.photo || "");
      setDept(m.dept || depts[0] || "");
      setRole(m.role || "");
      setMokjang(m.group || mokjangList[0] || "");
      setSmallGroup(m.small_group || "");
      setTalent(m.talent || "");
      setRegisteredDate(m.registered_date || new Date().toISOString().slice(0, 10));
      setBaptismType(m.baptism_type || "");
      setBaptismDate(m.baptism_date || "");
      setWeddingAnniversary(m.wedding_anniversary || "");
      setFamilyId(m.family_id || "");
      setFamilyRelation(m.family_relation || "");
      setIsNewFamily(m.is_new_family ?? false);
      setFirstVisitDate(m.first_visit_date || "");
      setVisitPath(m.visit_path || "");
      setReferrerId(m.referrer_id || "");
      setReferrerName(m.referrer_name || "");
      setMemberStatus(m.member_status || "활동");
      setStatusReason(m.status_reason || "");
      setPrayer(m.prayer || "");
      setMemo(m.memo || "");
      setIsProspect(m.is_prospect ?? false);
    } else {
      setName("");
      setGender("");
      setBirth("");
      setPhone("");
      setEmail("");
      setAddress("");
      setJob("");
      setPhotoPreview("");
      setDept(depts[0] || "");
      setRole("");
      setMokjang(mokjangList[0] || "");
      setSmallGroup("");
      setTalent("");
      setRegisteredDate(new Date().toISOString().slice(0, 10));
      setBaptismType("");
      setBaptismDate("");
      setWeddingAnniversary("");
      setFamilyId("");
      setFamilyRelation("");
      setIsNewFamily(false);
      setFirstVisitDate("");
      setVisitPath("");
      setReferrerId("");
      setReferrerName("");
      setMemberStatus("활동");
      setStatusReason("");
      setPrayer("");
      setMemo("");
      setIsProspect(false);
    }
    setPhotoFile(null);
  }, [member, depts, mokjangList]);

  useEffect(() => {
    if (familyId && db.members.length) {
      setSameFamilyMembers(db.members.filter((m) => m.family_id === familyId));
    } else {
      setSameFamilyMembers([]);
    }
  }, [familyId, db.members]);

  useEffect(() => {
    if (!familySearchOpen || !supabase) return;
    supabase
      .from("families")
      .select("id, family_name, created_at")
      .order("family_name")
      .then(({ data }) => setFamilies((data as Family[]) || []));
  }, [familySearchOpen]);

  useEffect(() => {
    if (!referrerSearchOpen) return;
    const q = referrerSearchQ.trim().toLowerCase();
    if (q.length < 1) {
      setReferrerCandidates(db.members.slice(0, 20));
    } else {
      setReferrerCandidates(
        db.members.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.phone?.replace(/\D/g, "").includes(q)
        )
      );
    }
  }, [referrerSearchOpen, referrerSearchQ, db.members]);

  const handleStatusChange = (newStatus: Member["member_status"]) => {
    if (member && member.member_status !== newStatus) {
      setPendingStatus(newStatus);
      setStatusReasonModalOpen(true);
    } else {
      setMemberStatus(newStatus);
    }
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      setMemberStatus(pendingStatus);
      setPendingStatus(null);
      setStatusReasonModalOpen(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    const nameTrim = name.trim();
    if (!nameTrim) {
      toast("이름을 입력하세요", "err");
      return;
    }
    if (!supabase) {
      toast("연결을 확인해주세요", "err");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: nameTrim,
        dept: dept || null,
        role: role || null,
        birth: birth || null,
        gender: gender || null,
        phone: phone || null,
        address: address || null,
        family: null,
        status: memberStatus,
        source: null,
        prayer: prayer || null,
        memo: memo || null,
        mokjang: mokjang || null,
        email: email || null,
        job: job || null,
        registered_date: registeredDate || null,
        small_group: smallGroup || null,
        talent: talent || null,
        is_new_family: isNewFamily,
        first_visit_date: firstVisitDate || null,
        visit_path: visitPath || null,
        referrer_id: referrerId || null,
        referrer_name: referrerName || null,
        family_id: familyId || null,
        family_relation: familyRelation || null,
        member_status: memberStatus,
        status_reason: statusReason || null,
        baptism_type: baptismType || null,
        baptism_date: baptismType && baptismType !== "미세례" ? baptismDate || null : null,
        wedding_anniversary: weddingAnniversary || null,
        is_prospect: isProspect,
      };
      let memberId: string;
      if (member?.id) {
        memberId = member.id;
        const { id: _, ...updatePayload } = payload;
        console.log("=== DB UPDATE 시도 ===", updatePayload);
        const { data, error } = await supabase.from("members").update(updatePayload).eq("id", member.id).select();
        console.log("=== DB UPDATE 결과 ===", { data, error });
        if (error) {
          console.error("=== DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          throw error;
        }
      } else {
        console.log("=== DB INSERT 시도 ===", payload);
        const { data: inserted, error } = await supabase.from("members").insert(payload).select("id").single();
        console.log("=== DB INSERT 결과 ===", { data: inserted, error });
        if (error) {
          console.error("=== DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          throw error;
        }
        memberId = (inserted as { id: string }).id;
      }
      if (photoFile && memberId) {
        const path = `${memberId}.jpg`;
        const { error: upErr } = await supabase.storage.from("member-photos").upload(path, photoFile, { upsert: true, contentType: photoFile.type });
        if (!upErr) {
          const { data: signed } = await supabase.storage.from("member-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
          if (signed?.signedUrl) {
            await supabase.from("members").update({ photo: signed.signedUrl }).eq("id", memberId);
          }
        }
      }
      const saved: Member = {
        ...(member || {}),
        id: memberId,
        name: nameTrim,
        dept: dept || undefined,
        role: role || undefined,
        birth: birth || undefined,
        gender: gender || undefined,
        phone: phone || undefined,
        address: address || undefined,
        status: memberStatus,
        prayer: prayer || undefined,
        memo: memo || undefined,
        group: mokjang || undefined,
        email: email || undefined,
        job: job || undefined,
        registered_date: registeredDate || undefined,
        small_group: smallGroup || undefined,
        talent: talent || undefined,
        is_new_family: isNewFamily,
        first_visit_date: firstVisitDate || undefined,
        visit_path: visitPath || undefined,
        referrer_id: referrerId || undefined,
        referrer_name: referrerName || undefined,
        family_id: familyId || undefined,
        family_relation: familyRelation || undefined,
        member_status: memberStatus,
        status_reason: statusReason || undefined,
        baptism_type: baptismType || undefined,
        baptism_date: baptismDate || undefined,
        wedding_anniversary: weddingAnniversary || undefined,
        is_prospect: isProspect,
      } as Member;
      if (memberStatus !== member?.member_status && member?.id && supabase) {
        await supabase.from("member_status_history").insert({
          member_id: member.id,
          previous_status: member.member_status ?? null,
          new_status: memberStatus,
          reason: statusReason || null,
        });
      }
      toast("저장되었습니다", "ok");
      onSaved(saved);
    } catch (e) {
      console.error(e);
      toast("저장에 실패했습니다", "err");
    } finally {
      setSaving(false);
    }
  };

  const cardClass = "bg-white rounded-xl shadow-sm border border-gray-100 p-5";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";
  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1e3a5f]";

  return (
    <div className="max-h-[90vh] overflow-y-auto space-y-6 p-4">
      {isProspect && (
        <div className="rounded-lg bg-amber-100 text-amber-800 px-3 py-2 text-sm font-medium">
          관심 성도
        </div>
      )}

      {/* 섹션 1: 기본 정보 */}
      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">기본 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>이름 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>성별</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
              <option value="">선택</option>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>
          <div>
            <CalendarDropdown label="생년월일" value={birth} onChange={setBirth} showClearButton />
          </div>
          <div>
            <label className={labelClass}>연락처</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>직업</label>
            <input type="text" value={job} onChange={(e) => setJob(e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>주소</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>사진</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                {photoPreview ? <img src={photoPreview} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-xs">사진</span>}
              </div>
              <div>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <button type="button" onClick={() => photoInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  업로드
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 섹션 2: 교회 정보 */}
      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">교회 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>부서</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputClass}>
              {depts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>직분</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="">선택</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>목장</label>
            <select value={mokjang} onChange={(e) => setMokjang(e.target.value)} className={inputClass}>
              <option value="">선택</option>
              {mokjangList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>소그룹/셀</label>
            <input type="text" value={smallGroup} onChange={(e) => setSmallGroup(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>은사/재능</label>
            <input type="text" value={talent} onChange={(e) => setTalent(e.target.value)} className={inputClass} />
          </div>
          <div>
            <CalendarDropdown label="등록일" value={registeredDate} onChange={setRegisteredDate} showClearButton />
          </div>
        </div>
      </section>

      {/* 섹션 3: 세례/가족 */}
      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">세례/가족</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>세례 구분</label>
            <select value={baptismType} onChange={(e) => setBaptismType((e.target.value || "") as Member["baptism_type"])} className={inputClass}>
              <option value="">선택</option>
              {BAPTISM_TYPES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <CalendarDropdown label="세례일" value={baptismDate} onChange={setBaptismDate} showClearButton disabled={baptismType === "미세례" || !baptismType} />
          </div>
          <div>
            <CalendarDropdown label="결혼기념일" value={weddingAnniversary} onChange={setWeddingAnniversary} showClearButton />
          </div>
          <div>
            <label className={labelClass}>가족</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFamilySearchOpen(true)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                가족 찾기
              </button>
              {familyId && <span className="text-sm text-gray-600 self-center">연결됨</span>}
            </div>
          </div>
          <div>
            <label className={labelClass}>가족 관계</label>
            <select value={familyRelation} onChange={(e) => setFamilyRelation((e.target.value || "") as Member["family_relation"])} className={inputClass}>
              <option value="">선택</option>
              {FAMILY_RELATIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        {sameFamilyMembers.length > 0 && (
          <div className="mt-3">
            <div className={labelClass}>같은 가족 구성원</div>
            <ul className="text-sm text-gray-600 space-y-1">
              {sameFamilyMembers.map((m) => (
                <li key={m.id}>{m.name} {m.family_relation ? `(${m.family_relation})` : ""}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 섹션 4: 새가족 정보 */}
      <section className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">새가족 정보</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isNewFamily} onChange={(e) => setIsNewFamily(e.target.checked)} className="rounded" />
            <span className="text-sm">새가족</span>
          </label>
        </div>
        {isNewFamily && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <CalendarDropdown label="첫 방문일" value={firstVisitDate} onChange={setFirstVisitDate} showClearButton />
            </div>
            <div>
              <label className={labelClass}>방문 경로</label>
              <select value={visitPath} onChange={(e) => setVisitPath((e.target.value || "") as Member["visit_path"])} className={inputClass}>
                <option value="">선택</option>
                {VISIT_PATHS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>인도자</label>
              <div className="flex gap-2">
                <input type="text" value={referrerName} readOnly placeholder="검색하여 선택" className={inputClass} />
                <button type="button" onClick={() => setReferrerSearchOpen(true)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  검색
                </button>
                {referrerId && <button type="button" onClick={() => { setReferrerId(""); setReferrerName(""); }} className="text-sm text-gray-500">해제</button>}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 섹션 5: 상태/메모 */}
      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">상태/메모</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>성도 상태</label>
            <select value={memberStatus} onChange={(e) => handleStatusChange((e.target.value as Member["member_status"]))} className={inputClass}>
              {MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>기도제목</label>
            <textarea value={prayer} onChange={(e) => setPrayer(e.target.value)} rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>메모</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className={inputClass} />
          </div>
        </div>
      </section>

      {/* 섹션 6: 관심 성도 */}
      <section className={cardClass}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isProspect} onChange={(e) => setIsProspect(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">관심 성도 (등록 전)</span>
        </label>
      </section>

      {/* 버튼 */}
      <div className="flex gap-3 justify-end sticky bottom-0 bg-white py-3 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
          취소
        </button>
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      {/* 가족 찾기 모달 */}
      {familySearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFamilySearchOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-[#1e3a5f] mb-3">가족 그룹 선택</h4>
            <ul className="space-y-2">
              {families.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => { setFamilyId(f.id); setFamilySearchOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">
                    {f.family_name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setFamilySearchOpen(false)} className="mt-3 w-full py-2 rounded-lg border border-gray-200 text-sm">닫기</button>
          </div>
        </div>
      )}

      {/* 인도자 검색 모달 */}
      {referrerSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReferrerSearchOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-[#1e3a5f] mb-3">인도자 검색</h4>
            <input type="text" value={referrerSearchQ} onChange={(e) => setReferrerSearchQ(e.target.value)} placeholder="이름 또는 연락처" className={inputClass + " mb-3"} />
            <ul className="space-y-1">
              {referrerCandidates.slice(0, 15).map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => { setReferrerId(m.id); setReferrerName(m.name || ""); setReferrerSearchOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                    {m.name} {m.phone ? `· ${m.phone}` : ""}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setReferrerSearchOpen(false)} className="mt-3 w-full py-2 rounded-lg border border-gray-200 text-sm">닫기</button>
          </div>
        </div>
      )}

      {/* 상태 변경 사유 모달 */}
      {statusReasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setStatusReasonModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-[#1e3a5f] mb-3">상태 변경 사유 (선택)</h4>
            <textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="사유 입력" rows={3} className={inputClass + " mb-3"} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStatusReasonModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={confirmStatusChange} className="flex-1 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

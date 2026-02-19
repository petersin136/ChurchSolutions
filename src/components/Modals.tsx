"use client";

import { useState, useEffect, useRef } from "react";
import type { DB, Member, Note } from "@/types/db";
import { getDepts } from "@/lib/store";
import { CATS_INCOME, CATS_EXPENSE } from "@/types/db";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { supabase } from "@/lib/supabase";

const STATUS_MAP: Record<string, string> = {
  새가족: "badge-blue",
  정착중: "badge-blue",
  정착: "badge-green",
  간헐: "badge-orange",
  위험: "badge-red",
  휴면: "badge-gray",
  "졸업/전출": "badge-gray",
};

interface ModalsProps {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  editMemberId: string | null;
  detailMemberId: string | null;
  noteTargetId: string | null;
  editPlanId: string | null;
  editSermonId: string | null;
  editIncId: string | null;
  editExpId: string | null;
  openMemberModal: boolean;
  openDetailModal: boolean;
  openNoteModal: boolean;
  openPlanModal: boolean;
  openSermonModal: boolean;
  openVisitModal: boolean;
  openIncomeModal: boolean;
  openExpenseModal: boolean;
  openBudgetModal: boolean;
  setOpenMemberModal: (v: boolean) => void;
  setOpenDetailModal: (v: boolean) => void;
  setOpenNoteModal: (v: boolean) => void;
  setOpenPlanModal: (v: boolean) => void;
  setOpenSermonModal: (v: boolean) => void;
  setOpenVisitModal: (v: boolean) => void;
  setOpenIncomeModal: (v: boolean) => void;
  setOpenExpenseModal: (v: boolean) => void;
  setOpenBudgetModal: (v: boolean) => void;
  setEditMemberId: (v: string | null) => void;
  setDetailMemberId: (v: string | null) => void;
  setNoteTargetId: (v: string | null) => void;
  setEditPlanId: (v: string | null) => void;
  setEditSermonId: (v: string | null) => void;
  setEditIncId: (v: string | null) => void;
  setEditExpId: (v: string | null) => void;
}

function compressImg(
  src: string,
  maxW: number,
  q: number,
  cb: (r: string) => void
) {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    let w = img.width,
      h = img.height;
    if (w > maxW) {
      h = (maxW / w) * h;
      w = maxW;
    }
    c.width = w;
    c.height = h;
    c.getContext("2d")?.drawImage(img, 0, 0, w, h);
    cb(c.toDataURL("image/jpeg", q));
  };
  img.src = src;
}

function dRow(icon: string, label: string, value: string) {
  return (
    <div className="d-row">
      <span className="d-icon">{icon}</span>
      <div>
        <div className="d-label">{label}</div>
        <div className="d-value">{value}</div>
      </div>
    </div>
  );
}

export function Modals({
  db,
  setDb,
  save,
  toast,
  editMemberId,
  detailMemberId,
  noteTargetId,
  editPlanId,
  editSermonId,
  editIncId,
  editExpId,
  openMemberModal,
  openDetailModal,
  openNoteModal,
  openPlanModal,
  openSermonModal,
  openVisitModal,
  openIncomeModal,
  openExpenseModal,
  openBudgetModal,
  setOpenMemberModal,
  setOpenDetailModal,
  setOpenNoteModal,
  setOpenPlanModal,
  setOpenSermonModal,
  setOpenVisitModal,
  setOpenIncomeModal,
  setOpenExpenseModal,
  setOpenBudgetModal,
  setEditMemberId,
  setDetailMemberId,
  setNoteTargetId,
  setEditPlanId,
  setEditSermonId,
  setEditIncId,
  setEditExpId,
}: ModalsProps) {
  const depts = getDepts(db);

  const [mName, setMName] = useState("");
  const [mDept, setMDept] = useState("");
  const [mRole, setMRole] = useState("");
  const [mBirth, setMBirth] = useState("");
  const [mGender, setMGender] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mAddr, setMAddr] = useState("");
  const [mFamily, setMFamily] = useState("");
  const [mStatus, setMStatus] = useState("새가족");
  const [mSource, setMSource] = useState("");
  const [mPrayer, setMPrayer] = useState("");
  const [mMemo, setMMemo] = useState("");
  const [mPhotoPreview, setMPhotoPreview] = useState("");

  const [noteDate, setNoteDate] = useState("");
  const [noteType, setNoteType] = useState<Note["type"]>("memo");
  const [noteContent, setNoteContent] = useState("");

  const [pTitle, setPTitle] = useState("");
  const [pDate, setPDate] = useState("");
  const [pTime, setPTime] = useState("");
  const [pCat, setPCat] = useState("예배/설교");
  const [pMemo, setPMemo] = useState("");

  const [sDate, setSDate] = useState("");
  const [sService, setSService] = useState("주일 1부");
  const [sText, setSText] = useState("");
  const [sTitle, setSTitle] = useState("");
  const [sCore, setSCore] = useState("");
  const [sStatus, setSStatus] = useState("구상중");
  const [sNotes, setSNotes] = useState("");

  const [vDate, setVDate] = useState("");
  const [vMember, setVMember] = useState("");
  const [vType, setVType] = useState("정기심방");
  const [vContent, setVContent] = useState("");

  const [incDate, setIncDate] = useState("");
  const [incType, setIncType] = useState("tithe");
  const [incAmount, setIncAmount] = useState("");
  const [incDonor, setIncDonor] = useState("");
  const [incMethod, setIncMethod] = useState("현금");
  const [incMemo, setIncMemo] = useState("");

  const [expDate, setExpDate] = useState("");
  const [expCat, setExpCat] = useState("인건비");
  const [expItem, setExpItem] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expResol, setExpResol] = useState("");
  const [expMemo, setExpMemo] = useState("");

  const mPhotoInputRef = useRef<HTMLInputElement>(null);
  const expReceiptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openMemberModal) {
      const curDepts = getDepts(db);
      const m = editMemberId
        ? db.members.find((x) => x.id === editMemberId)
        : null;
      if (m) {
        setMName(m.name || "");
        setMDept(m.dept || curDepts[0] || "");
        setMRole(m.role || "");
        setMBirth(m.birth || "");
        setMGender(m.gender || "");
        setMPhone(m.phone || "");
        setMAddr(m.address || "");
        setMFamily(m.family || "");
        setMStatus(m.status || "새가족");
        setMSource(m.source || "");
        setMPrayer(m.prayer || "");
        setMMemo(m.memo || "");
        setMPhotoPreview(m.photo || "");
      } else {
        setMName("");
        setMDept(curDepts[0] || "");
        setMRole("");
        setMBirth("");
        setMGender("");
        setMPhone("");
        setMAddr("");
        setMFamily("");
        setMStatus("새가족");
        setMSource("");
        setMPrayer("");
        setMMemo("");
        setMPhotoPreview("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMemberModal, editMemberId]);

  useEffect(() => {
    if (openNoteModal && noteTargetId) {
      setNoteDate(new Date().toISOString().split("T")[0]);
      setNoteType("memo");
      setNoteContent("");
    }
  }, [openNoteModal, noteTargetId]);

  useEffect(() => {
    if (openPlanModal) {
      const p = editPlanId
        ? db.plans.find((x) => x.id === editPlanId)
        : null;
      if (p) {
        setPTitle(p.title);
        setPDate(p.date);
        setPTime(p.time || "");
        setPCat(p.cat);
        setPMemo(p.memo || "");
      } else {
        setPTitle("");
        setPDate(new Date().toISOString().split("T")[0]);
        setPTime("");
        setPCat("예배/설교");
        setPMemo("");
      }
    }
  }, [openPlanModal, editPlanId, db.plans]);

  useEffect(() => {
    if (openSermonModal) {
      const s = editSermonId
        ? db.sermons.find((x) => x.id === editSermonId)
        : null;
      if (s) {
        setSDate(s.date);
        setSService(s.service);
        setSText(s.text || "");
        setSTitle(s.title || "");
        setSCore(s.core || "");
        setSStatus(s.status);
        setSNotes(s.notes || "");
      } else {
        setSDate("");
        setSService("주일 1부");
        setSText("");
        setSTitle("");
        setSCore("");
        setSStatus("구상중");
        setSNotes("");
      }
    }
  }, [openSermonModal, editSermonId, db.sermons]);

  useEffect(() => {
    if (openVisitModal) {
      setVDate(new Date().toISOString().split("T")[0]);
      setVMember(db.members[0]?.id || "");
      setVType("정기심방");
      setVContent("");
    }
  }, [openVisitModal, db.members]);

  useEffect(() => {
    if (openIncomeModal) {
      const r = editIncId
        ? db.income.find((x) => x.id === editIncId)
        : null;
      if (r) {
        setIncDate(r.date);
        setIncType(CATS_INCOME.find((c) => c.id === r.type || c.name === r.type)?.id ?? "tithe");
        setIncAmount(String(r.amount));
        setIncDonor(r.donor || "");
        setIncMethod(r.method || "현금");
        setIncMemo(r.memo || "");
      } else {
        setIncDate(new Date().toISOString().split("T")[0]);
        setIncType("tithe");
        setIncAmount("");
        setIncDonor("");
        setIncMethod("현금");
        setIncMemo("");
      }
    }
  }, [openIncomeModal, editIncId, db.income]);

  useEffect(() => {
    if (openExpenseModal) {
      const r = editExpId
        ? db.expense.find((x) => x.id === editExpId)
        : null;
      if (r) {
        setExpDate(r.date);
        setExpCat(r.category);
        setExpItem(r.item || "");
        setExpAmount(String(r.amount));
        setExpResol(r.resolution || "");
        setExpMemo(r.memo || "");
      } else {
        setExpDate(new Date().toISOString().split("T")[0]);
        setExpCat("인건비");
        setExpItem("");
        setExpAmount("");
        setExpResol("");
        setExpMemo("");
      }
    }
  }, [openExpenseModal, editExpId, db.expense]);

  function saveMember() {
    const name = mName.trim();
    if (!name) {
      toast("이름을 입력하세요", "err");
      return;
    }
    const data: Partial<Member> = {
      name,
      dept: mDept,
      role: mRole.trim(),
      birth: mBirth,
      gender: mGender,
      phone: mPhone.trim(),
      address: mAddr.trim(),
      family: mFamily.trim(),
      status: mStatus,
      source: mSource,
      prayer: mPrayer.trim(),
      memo: mMemo.trim(),
      photo: mPhotoPreview,
    };
    if (editMemberId) {
      setDb((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === editMemberId ? { ...m, ...data } : m
        ),
      }));
      toast("수정 완료", "ok");
    } else {
      setDb((prev) => ({
        ...prev,
        members: [
          ...prev.members,
          {
            ...data,
            id: "mb_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
            createdAt: new Date().toISOString(),
          } as Member,
        ],
      }));
      toast("등록 완료", "ok");
    }
    save();
    setOpenMemberModal(false);
    setEditMemberId(null);
  }

  function deleteMember(id: string) {
    if (typeof window !== "undefined" && !window.confirm("삭제하시겠습니까?"))
      return;
    setDb((prev) => {
      const { [id]: _, ...att } = prev.attendance;
      const { [id]: _r, ...attReasons } = prev.attendanceReasons || {};
      const { [id]: __, ...notes } = prev.notes;
      return {
        ...prev,
        members: prev.members.filter((m) => m.id !== id),
        attendance: att,
        attendanceReasons: Object.keys(attReasons).length ? attReasons : undefined,
        notes,
      };
    });
    save();
    setOpenDetailModal(false);
    setDetailMemberId(null);
    toast("삭제 완료", "warn");
  }

  function saveNote() {
    const content = noteContent.trim();
    if (!content || !noteTargetId) {
      toast("내용을 입력하세요", "err");
      return;
    }
    const note: Note = {
      date: noteDate,
      type: noteType,
      content,
      createdAt: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      notes: {
        ...prev.notes,
        [noteTargetId]: [...(prev.notes[noteTargetId] || []), note],
      },
    }));
    if (noteType === "prayer") {
      setDb((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === noteTargetId ? { ...m, prayer: content } : m
        ),
      }));
    }
    save();
    setOpenNoteModal(false);
    setNoteTargetId(null);
    toast("기록 저장", "ok");
  }

  function savePlan() {
    const title = pTitle.trim();
    if (!title) {
      toast("제목을 입력하세요", "err");
      return;
    }
    const data = { title, date: pDate, time: pTime, cat: pCat, memo: pMemo.trim() };
    if (editPlanId) {
      setDb((prev) => ({
        ...prev,
        plans: prev.plans.map((p) =>
          p.id === editPlanId ? { ...p, ...data } : p
        ),
      }));
      toast("수정 완료", "ok");
    } else {
      setDb((prev) => ({
        ...prev,
        plans: [
          ...prev.plans,
          { ...data, id: "pl_" + Date.now() },
        ],
      }));
      toast("일정 등록", "ok");
    }
    save();
    setOpenPlanModal(false);
    setEditPlanId(null);
  }

  function saveSermon() {
    if (!sDate) {
      toast("날짜를 선택하세요", "err");
      return;
    }
    const data = {
      date: sDate,
      service: sService,
      text: sText.trim(),
      title: sTitle.trim(),
      core: sCore.trim(),
      status: sStatus,
      notes: sNotes.trim(),
    };
    if (editSermonId) {
      setDb((prev) => ({
        ...prev,
        sermons: prev.sermons.map((s) =>
          s.id === editSermonId ? { ...s, ...data } : s
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        sermons: [
          ...prev.sermons,
          { ...data, id: "sr_" + Date.now() },
        ],
      }));
    }
    save();
    setOpenSermonModal(false);
    setEditSermonId(null);
    toast("저장 완료", "ok");
  }

  function saveVisit() {
    const content = vContent.trim();
    if (!content) {
      toast("내용을 입력하세요", "err");
      return;
    }
    const v = {
      id: "vi_" + Date.now(),
      date: vDate,
      memberId: vMember,
      type: vType,
      content,
    };
    setDb((prev) => ({
      ...prev,
      visits: [...prev.visits, v],
      notes: {
        ...prev.notes,
        [vMember]: [
          ...(prev.notes[vMember] || []),
          {
            date: v.date,
            type: "visit" as const,
            content: `[${v.type}] ${content}`,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }));
    save();
    setOpenVisitModal(false);
    toast("심방 기록 저장", "ok");
  }

  async function saveIncome() {
    const amount = Number(incAmount);
    if (!amount) {
      toast("금액을 입력하세요", "err");
      return;
    }
    const data = {
      date: incDate,
      type: incType,
      amount,
      donor: incDonor.trim() || null,
      method: incMethod,
      memo: incMemo.trim() || null,
    };
    if (!supabase) {
      toast("Supabase 연결을 확인하세요.", "err");
      return;
    }
    try {
      if (editIncId) {
        console.log("=== INCOME UPDATE 시도 ===", { id: editIncId, ...data });
        const { data: res, error } = await supabase.from("income").update(data).eq("id", editIncId).select();
        console.log("=== INCOME UPDATE 결과 ===", { data: res, error });
        if (error) {
          console.error("=== INCOME DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          return;
        }
        setDb((prev) => ({
          ...prev,
          income: prev.income.map((r) =>
            r.id === editIncId ? { ...r, ...data, donor: data.donor ?? undefined, memo: data.memo ?? undefined } : r
          ),
        }));
        toast("수정 완료", "ok");
      } else {
        console.log("=== INCOME INSERT 시도 ===", data);
        const { data: inserted, error } = await supabase.from("income").insert(data).select();
        console.log("=== INCOME INSERT 결과 ===", { data: inserted, error });
        if (error) {
          console.error("=== INCOME DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          return;
        }
        const row = Array.isArray(inserted) ? inserted[0] : inserted;
        const newId = (row as { id: string } | undefined)?.id ?? "in_" + Date.now();
        setDb((prev) => ({
          ...prev,
          income: [...prev.income, { ...data, id: newId, donor: data.donor ?? undefined, memo: data.memo ?? undefined }],
        }));
        toast("수입 등록 완료", "ok");
      }
      setOpenIncomeModal(false);
      setEditIncId(null);
    } catch (e) {
      console.error("saveIncome 예외", e);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  async function saveExpense() {
    const amount = Number(expAmount);
    if (!amount) {
      toast("금액을 입력하세요", "err");
      return;
    }
    const data = {
      date: expDate,
      category: expCat,
      item: expItem.trim() || null,
      amount,
      resolution: expResol.trim() || null,
      memo: expMemo.trim() || null,
    };
    if (!supabase) {
      toast("Supabase 연결을 확인하세요.", "err");
      return;
    }
    try {
      if (editExpId) {
        console.log("=== EXPENSE UPDATE 시도 ===", { id: editExpId, ...data });
        const { data: res, error } = await supabase.from("expense").update(data).eq("id", editExpId).select();
        console.log("=== EXPENSE UPDATE 결과 ===", { data: res, error });
        if (error) {
          console.error("=== EXPENSE DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          return;
        }
        setDb((prev) => ({
          ...prev,
          expense: prev.expense.map((r) =>
            r.id === editExpId ? { ...r, ...data, item: data.item ?? undefined, resolution: data.resolution ?? undefined, memo: data.memo ?? undefined } : r
          ),
        }));
        toast("수정 완료", "ok");
      } else {
        console.log("=== EXPENSE INSERT 시도 ===", data);
        const { data: inserted, error } = await supabase.from("expense").insert(data).select();
        console.log("=== EXPENSE INSERT 결과 ===", { data: inserted, error });
        if (error) {
          console.error("=== EXPENSE DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          return;
        }
        const row = Array.isArray(inserted) ? inserted[0] : inserted;
        const newId = (row as { id: string } | undefined)?.id ?? "ex_" + Date.now();
        setDb((prev) => ({
          ...prev,
          expense: [...prev.expense, { ...data, id: newId, item: data.item ?? undefined, resolution: data.resolution ?? undefined, memo: data.memo ?? undefined }],
        }));
        toast("지출 등록 완료", "ok");
      }
      setOpenExpenseModal(false);
      setEditExpId(null);
    } catch (e) {
      console.error("saveExpense 예외", e);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  function saveBudget() {
    const budget: Record<string, number> = {};
    CATS_EXPENSE.forEach((cat) => {
      const el = document.getElementById("bgt_" + cat) as HTMLInputElement;
      budget[cat] = el ? Number(el.value) || 0 : 0;
    });
    setDb((prev) => ({ ...prev, budget }));
    save();
    setOpenBudgetModal(false);
    toast("예산 저장 완료", "ok");
  }

  function prevPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      compressImg(src, 300, 0.7, setMPhotoPreview);
    };
    reader.readAsDataURL(file);
  }

  const detailMember = detailMemberId
    ? db.members.find((x) => x.id === detailMemberId)
    : null;
  const noteMember = noteTargetId
    ? db.members.find((x) => x.id === noteTargetId)
    : null;
  const memberNotes = noteTargetId
    ? (db.notes[noteTargetId] || []).slice(-5).reverse()
    : [];

  return (
    <>
      {/* Member Modal */}
      <div
        className={`modal-bg ${openMemberModal ? "open" : ""}`}
        id="memberModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2>{editMemberId ? "성도 수정" : "성도 등록"}</h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                setOpenMemberModal(false);
                setEditMemberId(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="fg">
              <label className="fl">이름 *</label>
              <input
                type="text"
                className="fi"
                placeholder="이름"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
              />
            </div>
            <div className="fg-row">
              <div className="fg">
                <label className="fl">부서</label>
                <select
                  className="fs"
                  value={mDept}
                  onChange={(e) => setMDept(e.target.value)}
                >
                  {depts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label className="fl">직분/학년</label>
                <input
                  type="text"
                  className="fi"
                  placeholder="예: 집사, 3학년"
                  value={mRole}
                  onChange={(e) => setMRole(e.target.value)}
                />
              </div>
            </div>
            <div className="fg-row">
              <div className="fg">
                <CalendarDropdown label="생년월일" value={mBirth} onChange={setMBirth} />
              </div>
              <div className="fg">
                <label className="fl">성별</label>
                <select
                  className="fs"
                  value={mGender}
                  onChange={(e) => setMGender(e.target.value)}
                >
                  <option value="">선택</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </div>
            </div>
            <div className="fg">
              <label className="fl">연락처</label>
              <input
                type="tel"
                className="fi"
                placeholder="010-0000-0000"
                value={mPhone}
                onChange={(e) => setMPhone(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">주소</label>
              <input
                type="text"
                className="fi"
                placeholder="주소"
                value={mAddr}
                onChange={(e) => setMAddr(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">가족 관계 메모</label>
              <input
                type="text"
                className="fi"
                placeholder="예: 김○○ 집사(배우자), 김○○(자녀-초등부)"
                value={mFamily}
                onChange={(e) => setMFamily(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">상태</label>
              <select
                className="fs"
                value={mStatus}
                onChange={(e) => setMStatus(e.target.value)}
              >
                <option value="새가족">새가족</option>
                <option value="정착중">정착중</option>
                <option value="정착">정착</option>
                <option value="간헐">간헐</option>
                <option value="위험">위험</option>
                <option value="휴면">휴면</option>
                <option value="졸업/전출">졸업/전출</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">등록 경로</label>
              <select
                className="fs"
                value={mSource}
                onChange={(e) => setMSource(e.target.value)}
              >
                <option value="">선택</option>
                <option value="기존교인자녀">기존 교인 자녀</option>
                <option value="전도">전도</option>
                <option value="전입">타교회 전입</option>
                <option value="지인소개">지인 소개</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">프로필 사진</label>
              <div
                className="upload-area"
                onClick={() => mPhotoInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div className="ua-icon">📷</div>
                <div className="ua-text">사진 선택 (자동 압축)</div>
              </div>
              <input
                ref={mPhotoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={prevPhoto}
              />
              {mPhotoPreview && (
                <img
                  id="mPhotoPreview"
                  className="img-preview"
                  src={mPhotoPreview}
                  alt=""
                />
              )}
            </div>
            <div className="fg">
              <label className="fl">기도제목</label>
              <textarea
                className="ft"
                placeholder="이 성도를 위한 기도제목"
                value={mPrayer}
                onChange={(e) => setMPrayer(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">특이사항 메모</label>
              <textarea
                className="ft"
                placeholder="사업장 개업, 병원치료, 가정문제, 진학, 취업 등"
                value={mMemo}
                onChange={(e) => setMMemo(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpenMemberModal(false);
                setEditMemberId(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={saveMember}>
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <div
        className={`modal-bg ${openDetailModal ? "open" : ""}`}
        id="detailModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2>상세 정보</h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                setOpenDetailModal(false);
                setDetailMemberId(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body" id="detailBody">
            {detailMember && (() => {
              const m = detailMember;
              const att = db.attendance[m.id] || {};
              const weeks = Object.keys(att).length;
              const present = Object.values(att).filter((v) => v === "p").length;
              const rate =
                weeks > 0 ? Math.round((present / weeks) * 100) : 0;
              const photo = m.photo ? (
                <img
                  src={m.photo}
                  alt=""
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "var(--radius-full)",
                    objectFit: "cover",
                    boxShadow: "var(--shadow-md)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "var(--radius-full)",
                    background:
                      "linear-gradient(135deg,var(--blue-light),var(--teal-light))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--blue)",
                  }}
                >
                  {m.name[0]}
                </div>
              );
              const memberNotesList = (db.notes[m.id] || [])
                .slice(-5)
                .reverse();
              return (
                <>
                  <div
                    style={{
                      textAlign: "center",
                      paddingBottom: 16,
                      borderBottom: "0.5px solid var(--sep)",
                      marginBottom: 16,
                    }}
                  >
                    {photo}
                    <h2
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        marginTop: 10,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.name}
                    </h2>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      <span
                        className={`badge ${STATUS_MAP[m.status || ""] || "badge-gray"}`}
                      >
                        {m.status}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--text2)",
                        }}
                      >
                        {m.dept} {m.role || ""}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,1fr)",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "var(--blue)",
                        }}
                      >
                        {rate}%
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>
                        출석률
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "var(--green)",
                        }}
                      >
                        {present}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>
                        출석
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>
                        {weeks}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>
                        기록
                      </div>
                    </div>
                  </div>
                  {dRow("📞", "연락처", m.phone || "-")}
                  {dRow("📍", "주소", m.address || "-")}
                  {dRow("👨‍👩‍👧‍👦", "가족", m.family || "-")}
                  {dRow("🎂", "생년월일", m.birth || "-")}
                  {dRow("📮", "등록경로", m.source || "-")}
                  {m.prayer && dRow("🙏", "기도제목", m.prayer)}
                  {m.memo && dRow("📝", "특이사항", m.memo)}
                  <div style={{ marginTop: 16 }}>
                    <div className="fl" style={{ marginBottom: 8 }}>
                      최근 기록
                    </div>
                    {memberNotesList.length
                      ? memberNotesList.map((n, i) => {
                          const typeLabel = {
                            memo: "📝 메모",
                            prayer: "🙏 기도",
                            visit: "🏠 심방",
                            event: "🎉 경조사",
                          }[n.type];
                          return (
                            <div
                              key={i}
                              className={`note-item ${n.type === "prayer" ? "prayer" : ""}`}
                            >
                              <div className="nd">
                                {n.date} · {typeLabel}
                              </div>
                              <div className="nc">{n.content}</div>
                            </div>
                          );
                        })
                      : (
                        <div
                          style={{
                            textAlign: "center",
                            color: "var(--text3)",
                            fontSize: 13,
                            padding: 20,
                          }}
                        >
                          기록 없음
                        </div>
                      )}
                  </div>
                </>
              );
            })()}
          </div>
          <div className="modal-foot" id="detailFoot">
            {detailMemberId && (
              <>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteMember(detailMemberId)}
                >
                  삭제
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setOpenDetailModal(false);
                    setEditMemberId(detailMemberId);
                    setOpenMemberModal(true);
                  }}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setOpenDetailModal(false);
                    setNoteTargetId(detailMemberId);
                    setOpenNoteModal(true);
                  }}
                >
                  기록 추가
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Note Modal */}
      <div
        className={`modal-bg ${openNoteModal ? "open" : ""}`}
        id="noteModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2 id="noteTitle">
              {noteMember ? noteMember.name + " — 기록 추가" : "메모/기도 기록"}
            </h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                setOpenNoteModal(false);
                setNoteTargetId(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="fg">
              <CalendarDropdown label="날짜" value={noteDate} onChange={setNoteDate} />
            </div>
            <div className="fg">
              <label className="fl">유형</label>
              <select
                className="fs"
                value={noteType}
                onChange={(e) =>
                  setNoteType(e.target.value as Note["type"])
                }
              >
                <option value="memo">일반 메모</option>
                <option value="prayer">기도제목</option>
                <option value="visit">심방 기록</option>
                <option value="event">경조사</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">내용</label>
              <textarea
                className="ft"
                placeholder="기록 내용"
                style={{ minHeight: 100 }}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="fl" style={{ marginBottom: 8 }}>
                이전 기록
              </div>
              <div id="noteHistory">
                {memberNotes.length
                  ? memberNotes.map((n, i) => {
                      const tl = {
                        memo: "📝",
                        prayer: "🙏",
                        visit: "🏠",
                        event: "🎉",
                      }[n.type];
                      return (
                        <div
                          key={i}
                          className={`note-item ${n.type === "prayer" ? "prayer" : ""}`}
                        >
                          <div className="nd">
                            {n.date} · {tl}
                          </div>
                          <div className="nc">{n.content}</div>
                        </div>
                      );
                    })
                  : (
                    <div
                      style={{
                        textAlign: "center",
                        color: "var(--text3)",
                        fontSize: 13,
                        padding: 16,
                      }}
                    >
                      기록 없음
                    </div>
                  )}
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpenNoteModal(false);
                setNoteTargetId(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={saveNote}>
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Plan Modal */}
      <div
        className={`modal-bg ${openPlanModal ? "open" : ""}`}
        id="planModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2 id="planModalTitle">
              {editPlanId ? "일정 수정" : "일정 등록"}
            </h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                setOpenPlanModal(false);
                setEditPlanId(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="fg">
              <label className="fl">제목 *</label>
              <input
                type="text"
                className="fi"
                placeholder="일정 제목"
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
              />
            </div>
            <div className="fg-row">
              <div className="fg">
                <CalendarDropdown label="날짜" value={pDate} onChange={setPDate} />
              </div>
              <div className="fg">
                <label className="fl">시간</label>
                <input
                  type="time"
                  className="fi"
                  value={pTime}
                  onChange={(e) => setPTime(e.target.value)}
                />
              </div>
            </div>
            <div className="fg">
              <label className="fl">카테고리</label>
              <select
                className="fs"
                value={pCat}
                onChange={(e) => setPCat(e.target.value)}
              >
                <option value="예배/설교">예배/설교</option>
                <option value="심방/상담">심방/상담</option>
                <option value="회의/행정">회의/행정</option>
                <option value="행사/교육">행사/교육</option>
                <option value="개인/경건">개인/경건</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">메모</label>
              <textarea
                className="ft"
                placeholder="상세 내용"
                value={pMemo}
                onChange={(e) => setPMemo(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpenPlanModal(false);
                setEditPlanId(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={savePlan}>
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Sermon Modal */}
      <div
        className={`modal-bg ${openSermonModal ? "open" : ""}`}
        id="sermonModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2>설교 등록</h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                setOpenSermonModal(false);
                setEditSermonId(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="fg">
              <CalendarDropdown label="설교 날짜" value={sDate} onChange={setSDate} />
            </div>
            <div className="fg">
              <label className="fl">예배</label>
              <select
                className="fs"
                value={sService}
                onChange={(e) => setSService(e.target.value)}
              >
                <option>주일 1부</option>
                <option>주일 2부</option>
                <option>주일 3부</option>
                <option>수요예배</option>
                <option>금요기도회</option>
                <option>특별예배</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">본문</label>
              <input
                type="text"
                className="fi"
                placeholder="예: 로마서 8:28-30"
                value={sText}
                onChange={(e) => setSText(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">제목</label>
              <input
                type="text"
                className="fi"
                placeholder="설교 제목"
                value={sTitle}
                onChange={(e) => setSTitle(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">핵심 메시지</label>
              <textarea
                className="ft"
                placeholder="한 줄 핵심"
                value={sCore}
                onChange={(e) => setSCore(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">준비 상태</label>
              <select
                className="fs"
                value={sStatus}
                onChange={(e) => setSStatus(e.target.value)}
              >
                <option value="구상중">구상 중</option>
                <option value="본문연구">본문 연구</option>
                <option value="초고작성">초고 작성</option>
                <option value="수정중">수정 중</option>
                <option value="완료">완료</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">설교 노트</label>
              <textarea
                className="ft"
                placeholder="예화, 적용, 참고자료 등"
                style={{ minHeight: 120 }}
                value={sNotes}
                onChange={(e) => setSNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpenSermonModal(false);
                setEditSermonId(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={saveSermon}>
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Visit Modal */}
      <div
        className={`modal-bg ${openVisitModal ? "open" : ""}`}
        id="visitModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2>심방 기록</h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => setOpenVisitModal(false)}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="fg">
              <CalendarDropdown label="날짜" value={vDate} onChange={setVDate} />
            </div>
            <div className="fg">
              <label className="fl">대상 성도</label>
              <select
                className="fs"
                value={vMember}
                onChange={(e) => setVMember(e.target.value)}
              >
                {db.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.dept})
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">유형</label>
              <select
                className="fs"
                value={vType}
                onChange={(e) => setVType(e.target.value)}
              >
                <option>정기심방</option>
                <option>위기심방</option>
                <option>새가족심방</option>
                <option>병문안</option>
                <option>경조사</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">내용</label>
              <textarea
                className="ft"
                placeholder="심방 내용, 후속 조치"
                style={{ minHeight: 100 }}
                value={vContent}
                onChange={(e) => setVContent(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpenVisitModal(false)}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={saveVisit}>
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Income Modal */}
      <div
        className={`modal-bg ${openIncomeModal ? "open" : ""}`}
        id="incomeModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2>수입 등록</h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                setOpenIncomeModal(false);
                setEditIncId(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="fg">
              <CalendarDropdown label="날짜 *" value={incDate} onChange={setIncDate} />
            </div>
            <div className="fg">
              <label className="fl">유형 *</label>
              <select
                className="fs"
                value={incType}
                onChange={(e) => setIncType(e.target.value)}
              >
                {CATS_INCOME.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">금액 *</label>
              <input
                type="number"
                className="fi"
                placeholder="0"
                value={incAmount}
                onChange={(e) => setIncAmount(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">헌금자</label>
              <input
                type="text"
                className="fi"
                placeholder="이름 (익명 가능)"
                value={incDonor}
                onChange={(e) => setIncDonor(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">방법</label>
              <select
                className="fs"
                value={incMethod}
                onChange={(e) => setIncMethod(e.target.value)}
              >
                <option value="현금">현금</option>
                <option value="계좌이체">계좌이체</option>
                <option value="온라인">온라인</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">메모</label>
              <input
                type="text"
                className="fi"
                placeholder="비고"
                value={incMemo}
                onChange={(e) => setIncMemo(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpenIncomeModal(false);
                setEditIncId(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={saveIncome}>
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Expense Modal */}
      <div
        className={`modal-bg ${openExpenseModal ? "open" : ""}`}
        id="expenseModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2>지출 등록</h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                setOpenExpenseModal(false);
                setEditExpId(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="fg">
              <CalendarDropdown label="날짜 *" value={expDate} onChange={setExpDate} />
            </div>
            <div className="fg">
              <label className="fl">계정과목 *</label>
              <select
                className="fs"
                value={expCat}
                onChange={(e) => setExpCat(e.target.value)}
              >
                {CATS_EXPENSE.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">항목</label>
              <input
                type="text"
                className="fi"
                placeholder="예: 전기요금, 인쇄비"
                value={expItem}
                onChange={(e) => setExpItem(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">금액 *</label>
              <input
                type="number"
                className="fi"
                placeholder="0"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">결의 번호</label>
              <input
                type="text"
                className="fi"
                placeholder="결의번호"
                value={expResol}
                onChange={(e) => setExpResol(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl">영수증</label>
              <div
                className="upload-area"
                onClick={() => expReceiptRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div className="ua-icon">🧾</div>
                <div className="ua-text">영수증 첨부</div>
              </div>
              <input
                ref={expReceiptRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: "none" }}
              />
            </div>
            <div className="fg">
              <label className="fl">메모</label>
              <input
                type="text"
                className="fi"
                placeholder="비고"
                value={expMemo}
                onChange={(e) => setExpMemo(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpenExpenseModal(false);
                setEditExpId(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={saveExpense}>
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Budget Modal */}
      <div
        className={`modal-bg ${openBudgetModal ? "open" : ""}`}
        id="budgetModal"
      >
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-head">
            <h2>연간 예산 설정</h2>
            <button
              type="button"
              className="modal-x"
              onClick={() => setOpenBudgetModal(false)}
            >
              ✕
            </button>
          </div>
          <div className="modal-body" id="budgetFormBody">
            {CATS_EXPENSE.map((cat) => (
              <div key={cat} className="fg">
                <label className="fl">{cat} 연간 예산</label>
                <input
                  type="number"
                  className="fi"
                  id={"bgt_" + cat}
                  defaultValue={db.budget[cat] || ""}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpenBudgetModal(false)}
            >
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={saveBudget}>
              저장
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

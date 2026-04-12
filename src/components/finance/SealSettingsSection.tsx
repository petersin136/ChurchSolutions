"use client";

import { useState, useEffect, useRef } from "react";
import { Lock, Upload, X, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";

const MAX_SEAL_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPT_IMAGE = "image/png,image/jpeg";

export interface SealSettingsSectionProps {
  churchId: string | null;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  onSaved?: () => void;
}

export function SealSettingsSection({ churchId, toast, onSaved }: SealSettingsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [churchAddress, setChurchAddress] = useState("");
  const [churchTel, setChurchTel] = useState("");
  const [sealPreviewUrl, setSealPreviewUrl] = useState<string | null>(null);
  const [sealFile, setSealFile] = useState<File | null>(null);
  /** 직인 UI에서 삭제한 뒤 저장 시 DB/Storage에서 제거 */
  const [sealDeleted, setSealDeleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // 고유번호 3-2-5 포맷
  const formatRegistrationNumber = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };
  const formatTel = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  useEffect(() => {
    if (!churchId || !supabase) return;
    setSealDeleted(false);
    (async () => {
      const { data } = await supabase.from("church_settings").select("*").eq("church_id", churchId).maybeSingle();
      if (data) {
        setRegistrationNumber((data as { church_registration_number?: string }).church_registration_number ?? "");
        setRepresentativeName((data as { representative_name?: string }).representative_name ?? "");
        setChurchAddress((data as { church_address?: string }).church_address ?? "");
        setChurchTel((data as { church_tel?: string }).church_tel ?? "");
        const url = (data as { seal_image_url?: string }).seal_image_url;
        if (url) {
          if (url.startsWith("http")) {
            setSealPreviewUrl(url);
          } else {
            const { data: signed } = await supabase.storage.from("church-seals").createSignedUrl(url, 3600);
            if (signed?.signedUrl) setSealPreviewUrl(signed.signedUrl);
          }
        }
      }
    })();
  }, [churchId]);

  const handleFile = (file: File | null) => {
    if (!file) {
      setSealFile(null);
      setSealDeleted(true);
      setSealPreviewUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (!ACCEPT_IMAGE.split(",").some((t) => file.type === t.trim())) {
      toast("PNG 또는 JPG만 업로드 가능합니다", "err");
      return;
    }
    if (file.size > MAX_SEAL_SIZE) {
      toast("파일 크기는 최대 2MB입니다", "err");
      return;
    }
    setSealDeleted(false);
    setSealFile(file);
    const url = URL.createObjectURL(file);
    setSealPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleSave = async () => {
    console.log("=== handleSave 시작 ===", { churchId, supabase: !!supabase, sealFile: !!sealFile, sealDeleted });
    if (!churchId || !supabase) {
      console.log("=== churchId 또는 supabase 없음, 중단 ===");
      toast("교회 정보를 불러올 수 없습니다", "err");
      return;
    }
    setLoading(true);
    try {
      let sealUrl: string | null = null;
      if (sealFile) {
        const path = `${churchId}/seal.png`;
        console.log("=== Storage 업로드 시작 ===", { path, fileType: sealFile.type, fileSize: sealFile.size });
        const { error: uploadErr } = await supabase.storage.from("church-seals").upload(path, sealFile, {
          contentType: sealFile.type,
          upsert: true,
        });
        console.log("=== Storage 업로드 결과 ===", { uploadErr });
        if (uploadErr) throw uploadErr;
        sealUrl = path;
      } else if (sealDeleted) {
        console.log("=== sealDeleted: 직인 삭제 후 저장 → DB null, Storage remove ===");
        sealUrl = null;
        const path = `${churchId}/seal.png`;
        const { error: removeErr } = await supabase.storage.from("church-seals").remove([path]);
        console.log("=== Storage remove 결과 ===", { removeErr });
        if (removeErr) throw removeErr;
      } else {
        console.log("=== 직인 변경 없음, 기존 URL 조회 ===");
        const { data: existing } = await supabase.from("church_settings").select("seal_image_url").eq("church_id", churchId).maybeSingle();
        sealUrl = (existing as { seal_image_url?: string } | null)?.seal_image_url ?? null;
        console.log("=== 기존 URL ===", sealUrl);
      }

      console.log("=== DB upsert 시작 ===", { sealUrl });
      const { error } = await supabase.from("church_settings").upsert(
        {
          church_id: churchId,
          church_registration_number: registrationNumber || null,
          representative_name: representativeName || null,
          church_address: churchAddress || null,
          church_tel: churchTel || null,
          seal_image_url: sealUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "church_id" }
      );
      console.log("=== DB upsert 결과 ===", { error });
      if (error) throw error;

      if (sealFile && sealUrl) {
        console.log("=== 직인 미리보기 URL 갱신(createSignedUrl) 시작 ===", { sealUrl });
        const { data: signed } = await supabase.storage.from("church-seals").createSignedUrl(sealUrl, 3600);
        console.log("=== createSignedUrl 결과 ===", { hasUrl: !!signed?.signedUrl });
        if (signed?.signedUrl) {
          const sep = signed.signedUrl.includes("?") ? "&" : "?";
          const busted = `${signed.signedUrl}${sep}t=${Date.now()}`;
          setSealPreviewUrl((prev) => {
            if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return busted;
          });
        }
        setSealFile(null);
        console.log("=== 직인 미리보기 URL 갱신 완료 ===");
      }

      console.log("=== 저장 성공 ===");
      toast("저장 완료", "ok");
      setSealDeleted(false);
      onSaved?.();
    } catch (e) {
      console.error("=== 저장 실패 ===", e);
      toast("저장 실패: " + (e instanceof Error ? e.message : String(e)), "err");
    } finally {
      setLoading(false);
      console.log("=== handleSave 종료 ===");
    }
  };

  const handlePreview = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const { registerKoreanFont } = await import("@/utils/fontLoader");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      await registerKoreanFont(doc);
      doc.setFont("NanumGothic", "bold");
      doc.setFontSize(18);
      doc.text("기부금 영수증", 105, 20, { align: "center" });
      doc.setFont("NanumGothic", "normal");
      doc.setFontSize(10);
      doc.text("기부자: 홍길동  주민등록번호: 000000-0000000  주소: (미리보기)", 20, 35);
      doc.text(`단체: (교회명)  고유번호: ${registrationNumber || "-"}  소재지: ${churchAddress || "-"}`, 20, 42);
      doc.text(`대표자: ${representativeName || "-"}  전화: ${churchTel || "-"}`, 20, 49);
      doc.text("총액: ₩1,000,000  귀속연도: " + new Date().getFullYear(), 20, 56);
      doc.text("소득세법 제34조, 조세특례제한법 제76조, 제88조의4에 의하여 위와 같이 기부금 영수증을 발급합니다.", 20, 80);
      doc.text(`대표자: ${representativeName || "-"}`, 20, 95);

      let sealBlob: Blob | null = null;
      if (sealFile) {
        sealBlob = sealFile;
      } else if (sealPreviewUrl) {
        try {
          const sep = sealPreviewUrl.includes("?") ? "&" : "?";
          const busted = `${sealPreviewUrl}${sep}nocache=${Date.now()}`;
          const res = await fetch(busted);
          if (res.ok) sealBlob = await res.blob();
        } catch {
          sealBlob = null;
        }
      }

      if (sealBlob) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            doc.addImage(reader.result as string, "PNG", 150, 85, 25, 25);
            const pdfBlob = doc.output("blob");
            setPreviewPdfUrl(URL.createObjectURL(pdfBlob));
            setPreviewModal(true);
          };
          reader.onerror = () => {
            const pdfBlob = doc.output("blob");
            setPreviewPdfUrl(URL.createObjectURL(pdfBlob));
            setPreviewModal(true);
          };
          reader.readAsDataURL(sealBlob);
          return;
        } catch {
          /* 직인 로드 실패 시 아래에서 직인 없는 PDF */
        }
      }

      const blob = doc.output("blob");
      setPreviewPdfUrl(URL.createObjectURL(blob));
      setPreviewModal(true);
    } catch (e) {
      console.error(e);
      toast("미리보기 생성 실패: " + (e instanceof Error ? e.message : String(e)), "err");
    }
  };

  const closePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl(null);
    setPreviewModal(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-800">기부금영수증 설정</h3>
        <Lock className="w-5 h-5 text-gray-500" aria-hidden />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">교회 고유번호 (국세청 기부금단체)</label>
          <input
            type="text"
            placeholder="000-00-00000"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(formatRegistrationNumber(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
          />
          <p className="mt-1 text-xs text-gray-500">ℹ️ 국세청 홈택스에서 확인 가능합니다</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">대표자 (담임목사) 이름</label>
          <input
            type="text"
            placeholder="홍길동"
            value={representativeName}
            onChange={(e) => setRepresentativeName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">교회 소재지</label>
          <input
            type="text"
            placeholder="서울특별시 강남구 ..."
            value={churchAddress}
            onChange={(e) => setChurchAddress(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">교회 전화번호</label>
          <input
            type="tel"
            placeholder="02-1234-5678"
            value={churchTel}
            onChange={(e) => setChurchTel(formatTel(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">교회 직인 이미지</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors min-h-[140px] flex flex-col items-center justify-center"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-blue-50"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("bg-blue-50"); }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("bg-blue-50"); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_IMAGE}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {sealPreviewUrl ? (
              <div className="relative">
                <div className="w-[120px] h-[120px] rounded-full border-2 border-red-400 overflow-hidden bg-white flex items-center justify-center mx-auto">
                  <img src={sealPreviewUrl} alt="직인 미리보기" className="w-full h-full object-contain" />
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="text-sm px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">변경</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleFile(null); }} className="text-sm px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">삭제</button>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500">이미지를 업로드하세요 (드래그앤드롭 / 클릭)</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-amber-600">⚠️ PNG 또는 JPG, 최대 2MB</p>
          <p className="text-xs text-gray-500">💡 투명 배경 PNG를 권장합니다 (영수증에 자연스럽게 찍힙니다)</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            data-seal-settings-save
            onClick={() => {
              console.log("=== 저장 버튼 클릭 ===");
              void handleSave();
            }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            저장
          </button>
          <button type="button" onClick={handlePreview} className="px-4 py-2 border border-gray-300 rounded-lg font-semibold flex items-center gap-1 hover:bg-gray-50">
            <Eye className="w-4 h-4" /> 미리보기
          </button>
        </div>
      </div>

      {previewModal && previewPdfUrl && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50" onClick={closePreview}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2 border-b">
              <button type="button" onClick={closePreview} className="p-2 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe src={previewPdfUrl} title="영수증 미리보기" className="flex-1 w-full min-h-[70vh] rounded-b-xl" />
            <div className="p-3 border-t flex justify-end">
              <button type="button" onClick={closePreview} className="px-4 py-2 bg-gray-700 text-white rounded-lg">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

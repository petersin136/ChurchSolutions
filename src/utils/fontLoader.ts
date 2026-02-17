/**
 * NanumGothic 폰트를 jsPDF에 등록하는 유틸
 * public/fonts/NanumGothic-Regular.ttf, NanumGothic-Bold.ttf 필요
 */
import type { jsPDF } from "jspdf";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function registerKoreanFont(doc: InstanceType<typeof jsPDF>): Promise<void> {
  try {
    const response = await fetch("/fonts/NanumGothic-Regular.ttf");
    if (!response.ok) throw new Error("NanumGothic-Regular.ttf fetch failed");
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    doc.addFileToVFS("NanumGothic-Regular.ttf", base64);
    doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");

    try {
      const boldResponse = await fetch("/fonts/NanumGothic-Bold.ttf");
      if (boldResponse.ok) {
        const boldBuffer = await boldResponse.arrayBuffer();
        const boldBase64 = arrayBufferToBase64(boldBuffer);
        doc.addFileToVFS("NanumGothic-Bold.ttf", boldBase64);
        doc.addFont("NanumGothic-Bold.ttf", "NanumGothic", "bold");
      }
    } catch {
      // Bold 없으면 Regular로 대체
    }
  } catch (error) {
    console.error("한글 폰트 로딩 실패:", error);
    throw new Error(
      "한글 폰트를 로딩할 수 없습니다. public/fonts/ 폴더에 NanumGothic-Regular.ttf 파일이 있는지 확인해주세요."
    );
  }
}

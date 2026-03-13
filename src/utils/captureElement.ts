import html2canvas from "html2canvas";

export async function captureElementAsBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    width: element.scrollWidth,
    height: element.scrollHeight,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("이미지 변환 실패"));
      },
      "image/png",
      0.95,
    );
  });
}

export async function captureElementAsDataUrl(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    width: element.scrollWidth,
    height: element.scrollHeight,
  });
  return canvas.toDataURL("image/png", 0.95);
}

export async function downloadElementAsImage(element: HTMLElement, filename: string) {
  const dataUrl = await captureElementAsDataUrl(element);
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

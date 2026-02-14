/**
 * Canvas API로 이미지 압축/리사이즈 (외부 라이브러리 없음)
 * 목표: 프로필 사진 1장당 최대 100KB 이하
 */
const TARGET_MAX_BYTES = 100 * 1024; // 100KB

export function compressImage(
  file: File,
  maxWidth = 400,
  quality = 0.7
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));

        ctx.drawImage(img, 0, 0, width, height);

        const tryBlob = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("Compression failed"));
              if (blob.size <= TARGET_MAX_BYTES || q <= 0.3) {
                const name = file.name.replace(/\.[^.]+$/i, ".jpg");
                const compressed = new File([blob], name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                return resolve(compressed);
              }
              tryBlob(Math.max(0.3, q - 0.15));
            },
            "image/jpeg",
            q
          );
        };

        tryBlob(quality);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

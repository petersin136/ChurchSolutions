declare global {
  interface Window {
    Kakao: any;
  }
}

let initialized = false;

export function initKakao() {
  if (typeof window === "undefined") return;
  if (!window.Kakao) {
    console.warn("[Kakao] SDK not loaded");
    return;
  }
  if (!initialized && !window.Kakao.isInitialized()) {
    window.Kakao.init("f4699f7c23c13caf0f5de8ec220151a7");
    initialized = true;
  }
}

export function shareToKakao({
  title,
  description,
  imageUrl,
  buttonLabel = "주보 보기",
  linkUrl,
}: {
  title: string;
  description: string;
  imageUrl: string;
  buttonLabel?: string;
  linkUrl: string;
}) {
  initKakao();
  if (!window.Kakao?.isInitialized()) {
    alert("카카오톡 공유 기능을 사용할 수 없습니다.");
    return;
  }

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title,
      description,
      imageUrl,
      link: { mobileWebUrl: linkUrl, webUrl: linkUrl },
    },
    buttons: [{ title: buttonLabel, link: { mobileWebUrl: linkUrl, webUrl: linkUrl } }],
  });
}

export function shareTextToKakao({
  title,
  description,
  linkUrl,
}: {
  title: string;
  description: string;
  linkUrl: string;
}) {
  initKakao();
  if (!window.Kakao?.isInitialized()) {
    alert("카카오톡 공유 기능을 사용할 수 없습니다.");
    return;
  }

  window.Kakao.Share.sendDefault({
    objectType: "text",
    text: `${title}\n\n${description}`,
    link: { mobileWebUrl: linkUrl, webUrl: linkUrl },
  });
}

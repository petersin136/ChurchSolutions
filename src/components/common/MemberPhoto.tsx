"use client";

import { useEffect, useState } from "react";
import { resolveMemberPhotoSrc } from "@/lib/member-photo";

type MemberPhotoProps = {
  photo?: string | null;
  name: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
};

export function useMemberPhotoSrc(photo: string | undefined | null): string | undefined {
  const [src, setSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void resolveMemberPhotoSrc(photo).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [photo]);
  return src;
}

export function MemberPhoto({ photo, name, className, style, fallback }: MemberPhotoProps) {
  const src = useMemberPhotoSrc(photo);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [photo, src]);

  if (!src || broken) {
    return <>{fallback ?? (name || "?")[0]}</>;
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      style={style}
      onError={() => setBroken(true)}
    />
  );
}

export function MemberPhotoBg({
  photo,
  className,
  style,
}: {
  photo?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const src = useMemberPhotoSrc(photo);
  if (!src) return null;
  return <div className={className} style={{ ...style, backgroundImage: `url(${src})` }} />;
}

export function MemberPhotoCircle({
  photo,
  name,
  imageClassName,
  fallbackClassName,
  getInitial,
}: {
  photo?: string | null;
  name: string;
  imageClassName: string;
  fallbackClassName: string;
  getInitial?: (name: string) => string;
}) {
  const src = useMemberPhotoSrc(photo);
  const initial = getInitial ? getInitial(name) : (name || "?")[0];
  if (src) {
    return <div className={imageClassName} style={{ backgroundImage: `url(${src})` }} />;
  }
  return <div className={fallbackClassName}>{initial}</div>;
}

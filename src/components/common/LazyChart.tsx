import { useRef, useState, useEffect, ReactNode } from "react";

interface LazyChartProps {
  width?: string | number;
  height: number;
  children: ReactNode;
}

export default function LazyChart({ width = "100%", height, children }: LazyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setReady(true);
          observer.disconnect();
        }
      }
    });
    observer.observe(ref.current);
    // 이미 크기가 있으면 바로 ready
    if (ref.current.offsetWidth > 0 && ref.current.offsetHeight > 0) {
      setReady(true);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width, height }}>
      {ready ? children : null}
    </div>
  );
}

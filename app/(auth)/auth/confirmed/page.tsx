"use client";

import dynamic from "next/dynamic";

const EmailConfirmedForm = dynamic(() => import("@/components/auth/EmailConfirmedForm"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh" }} />,
});

export default function Page() {
  return <EmailConfirmedForm />;
}

"use client";

import dynamic from "next/dynamic";

const ResetPasswordForm = dynamic(() => import("@/components/auth/ResetPasswordForm"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh" }} />,
});

export default function Page() {
  return <ResetPasswordForm />;
}

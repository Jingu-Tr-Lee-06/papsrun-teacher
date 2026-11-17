"use client";

import React from "react";
import dynamic from "next/dynamic";

// SSR을 완전히 배제하고 브라우저 클라이언트 환경에서만 로드
const WorkspaceClient = dynamic(
  () => import("@/components/workspace/WorkspaceClient"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 font-mono text-xs text-slate-500">
        1차시 지형 작도 워크스페이스 엔진 로딩 중...
      </div>
    ),
  }
);

export default function WorkspacePage() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <WorkspaceClient />
    </div>
  );
}
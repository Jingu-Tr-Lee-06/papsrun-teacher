import "./globals.css";
import React from "react";

export const metadata = {
  title: "PAPSrun Web Platform",
  description: "협업형 캠퍼스 러닝 경로 최적화 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="h-full w-full bg-slate-50 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
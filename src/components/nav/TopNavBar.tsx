"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";

interface TopNavBarProps {
  currentPath?: string;
}

export default function TopNavBar({ currentPath = "/workspace" }: TopNavBarProps) {
  const isOnline = isSupabaseConfigured();
  const [isMathDropdownOpen, setIsMathDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 5차시 관련 경로인지 확인
  const isMathActive = currentPath === "/topology" || currentPath === "/normalization";

  // 메뉴 바깥 영역 클릭 시 자동으로 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMathDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="z-30 flex items-center justify-between w-full px-5 border-b shadow-sm h-14 border-slate-200 bg-white/95 backdrop-blur">
      {/* 좌측 로고 및 실시간 동기화 상태 표시 */}
      <div className="flex items-center gap-3">
        <Link href="/workspace" className="flex items-center gap-2">
          <span className="flex items-center justify-center text-xs font-black text-white rounded-lg shadow-sm h-7 w-7 bg-sky-600">
            P
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-800">
            PAPSrun Web Platform
          </span>
        </Link>

        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-mono">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
            }`}
          />
          <span className={isOnline ? "font-semibold text-emerald-700" : "text-slate-500"}>
            {isOnline ? "Supabase 실시간 연동 정상" : "로컬 오프라인 모드"}
          </span>
        </div>
      </div>

      {/* 차시별 네비게이션 링크 */}
      <nav className="flex items-center gap-1.5">
        {/* 1차시 [지형 작도] */}
        <Link
          href="/workspace"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            currentPath === "/workspace"
              ? "bg-sky-50 text-sky-600 shadow-sm font-bold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          1차시 [지형 작도]
        </Link>

        {/* 5차시 [수학: 위상·정규화] 통합 드롭다운 (클릭 토글 & 갭 브릿지 패딩 적용) */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMathDropdownOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              isMathActive
                ? "bg-indigo-50 text-indigo-600 shadow-sm font-bold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            5차시 [수학: 위상·정규화]
            <svg
              className={`h-3 w-3 transition-transform ${isMathDropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 드롭다운 메뉴 (pt-1 패딩 브릿지로 마우스 이동 시 닫힘 방어) */}
          {isMathDropdownOpen && (
            <div className="absolute left-0 z-50 pt-1 top-full w-52">
              <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                <Link
                  href="/topology"
                  onClick={() => setIsMathDropdownOpen(false)}
                  className={`block rounded-md px-3 py-2 text-xs font-medium transition ${
                    currentPath === "/topology"
                      ? "bg-indigo-50 text-indigo-700 font-bold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  ① 위상(Topology) 결함 진단
                </Link>
                <Link
                  href="/normalization"
                  onClick={() => setIsMathDropdownOpen(false)}
                  className={`block rounded-md px-3 py-2 text-xs font-medium transition ${
                    currentPath === "/normalization"
                      ? "bg-indigo-50 text-indigo-700 font-bold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  ② Min-Max 정규화 & Cost 산출
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* 6차시 [다익스트라] */}
        <Link
          href="/algorithm"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            currentPath === "/algorithm"
              ? "bg-sky-50 text-sky-600 shadow-sm font-bold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          6차시 [다익스트라]
        </Link>

        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

        {/* 교사 관제 센터 */}
        <Link
          href="/admin"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            currentPath === "/admin"
              ? "bg-slate-100 text-slate-900 shadow-sm font-bold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          교사 관제 센터
        </Link>
      </nav>
    </header>
  );
}
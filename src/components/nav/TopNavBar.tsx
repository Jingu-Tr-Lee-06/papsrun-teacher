"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase";

interface TopNavBarProps {
  currentPath?: string;
}

interface UserSession {
  id: string;
  role: "teacher" | "student";
  loginId: string;
  name: string;
  classCode: string;
  studentNumber?: number;
}

export default function TopNavBar({ currentPath = "/workspace" }: TopNavBarProps) {
  const router = useRouter();
  const isOnline = isSupabaseConfigured();
  const [isMathDropdownOpen, setIsMathDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 5차시 관련 경로인지 확인
  const isMathActive = currentPath === "/topology" || currentPath === "/normalization";

  // 로그인 사용자 세션 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("papsrun_user");
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error("세션 파싱 실패:", e);
    }
  }, [currentPath]);

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

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem("papsrun_user");
    setCurrentUser(null);
    router.push("/login");
  };

  return (
    <header className="z-30 flex items-center justify-between w-full px-5 border-b shadow-sm h-14 border-slate-200 bg-white/95 backdrop-blur">
      {/* 좌측 로고 및 실시간 동기화 상태 표시 */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex items-center justify-center text-xs font-black text-white rounded-lg shadow-sm h-7 w-7 bg-sky-600">
            P
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-800">
            PAPSrun Web Platform
          </span>
        </Link>

        <div className="h-4 w-[1px] bg-slate-200 mx-0.5 hidden sm:block" />

        <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-mono">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
            }`}
          />
          <span className={isOnline ? "font-semibold text-emerald-700" : "text-slate-500"}>
            {isOnline ? "Supabase 연동 정상" : "오프라인 모드"}
          </span>
        </div>
      </div>

      {/* 중앙~우측 차시별 네비게이션 및 로그인 영역 */}
      <div className="flex items-center gap-1.5">
        <nav className="flex items-center gap-1">
          {/* 홈 안내 */}
          <Link
            href="/"
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              currentPath === "/"
                ? "bg-slate-100 text-slate-900 font-bold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            홈
          </Link>

          {/* 1차시 [지형 작도] */}
          <Link
            href="/workspace"
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              currentPath === "/workspace"
                ? "bg-sky-50 text-sky-600 shadow-sm font-bold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            1차시 [지형 작도]
          </Link>

          {/* 2차시 [복사에너지·표본] */}
          <Link
            href="/analysis"
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              currentPath === "/analysis"
                ? "bg-sky-50 text-sky-600 shadow-sm font-bold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            2차시 [복사에너지·표본]
          </Link>

          {/* 5차시 [수학: 위상·정규화] 통합 드롭다운 */}
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMathDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
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

            {isMathDropdownOpen && (
              <div className="absolute left-0 z-50 w-56 pt-1 top-full">
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
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              currentPath === "/algorithm"
                ? "bg-sky-50 text-sky-600 shadow-sm font-bold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            6차시 [다익스트라]
          </Link>

          {/* 7차시 [AI 바이브 코딩] */}
          <Link
            href="/vibecoding"
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              currentPath === "/vibecoding"
                ? "bg-emerald-50 text-emerald-700 shadow-sm font-bold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            7차시 [AI 바이브 코딩]
          </Link>

          {/* 교사 관제 센터: 교사 계정일 때만 노출 */}
          {currentUser?.role === "teacher" && (
            <>
              <div className="h-4 w-[1px] bg-slate-200 mx-1" />
              <Link
                href="/admin"
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  currentPath === "/admin" || currentPath === "/teacher"
                    ? "bg-amber-50 text-amber-800 border border-amber-200 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                교사 관제 센터
              </Link>
            </>
          )}
        </nav>

        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

        {/* 사용자 로그인 / 세션 상태 배지 */}
        {currentUser ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]">
              <span
                className={`rounded px-1.5 py-0.2 font-mono font-bold text-[10px] ${
                  currentUser.role === "teacher"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-sky-100 text-sky-700"
                }`}
              >
                {currentUser.classCode}
              </span>
              <span className="font-bold text-slate-700">{currentUser.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition shadow-sm ${
              currentPath === "/login"
                ? "bg-slate-800 text-white"
                : "bg-sky-600 text-white hover:bg-sky-700"
            }`}
          >
            로그인 / 가입
          </Link>
        )}
      </div>
    </header>
  );
}
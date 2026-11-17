"use client";

import React from "react";
import Link from "next/link";
import TopNavBar from "@/components/nav/TopNavBar";

export default function HomePage() {
  const features = [
    {
      step: "01",
      title: "캠퍼스 도로망 지형 작도",
      desc: "15m 자석 스냅 엔진을 기반으로 노면 피복과 일사 차광 속성을 학급 단위로 실시간 분담 작도합니다.",
      href: "/workspace",
      action: "1차시 작도 시작",
    },
    {
      step: "02",
      title: "네트워크 위상 무결성 진단",
      desc: "그래프 이론을 적용하여 고립 노드, 막다른 길, 분단 네트워크를 판별하고 완전 연결을 검증합니다.",
      href: "/teacher",
      action: "관제 대시보드",
    },
    {
      step: "03",
      title: "환경·생체역학 파이프라인",
      desc: "노면 알베도, 순흡수 복사에너지, 고도 경사도를 수식화하여 최적 러닝 경로 분석 데이터셋을 추출합니다.",
      href: "/workspace",
      action: "데이터 매핑 표",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <TopNavBar currentPath="/" />

      <main className="max-w-5xl px-6 py-16 mx-auto">
        {/* 상단 소개 헤더 */}
        <section className="pb-12 text-center border-b border-slate-200">
          <span className="inline-block px-3 py-1 font-mono text-xs font-semibold border rounded-full border-sky-200 bg-sky-50 text-sky-700">
            PAPSrun Web Platform
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            협업형 캠퍼스 러닝 경로 최적화 시스템
          </h1>
          <p className="max-w-2xl mx-auto mt-4 text-sm leading-relaxed text-slate-600">
            지리정보시스템(GIS)과 운동 생체역학, 환경 물리학을 결합하여
            학생 맞춤형 러닝 경로를 도출하는 8차시 STEAM 교육용 데이터 분석 플랫폼입니다.
          </p>

          <div className="flex justify-center gap-4 mt-8">
            <Link
              href="/workspace"
              className="rounded bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              1차시 워크스페이스 접속
            </Link>
            <Link
              href="/teacher"
              className="rounded border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              교사 관제 센터
            </Link>
          </div>
        </section>

        {/* 3단계 파이프라인 안내 카드 */}
        <section className="mt-14">
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-400">
            핵심 기능 모듈
          </h2>
          <div className="grid gap-4 mt-4 sm:grid-cols-3">
            {features.map((item) => (
              <div
                key={item.step}
                className="flex flex-col justify-between p-5 bg-white border rounded-lg shadow-sm border-slate-200"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-sky-600">
                    PHASE {item.step}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {item.desc}
                  </p>
                </div>
                <div className="pt-4 mt-6 border-t border-slate-100">
                  <Link
                    href={item.href}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    {item.action} &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 아키텍처 및 데이터 규격 안내 */}
        <section className="p-6 mt-12 bg-white border rounded-lg shadow-sm border-slate-200">
          <h3 className="text-xs font-bold text-slate-800">
            시스템 아키텍처 및 데이터 규격
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="font-mono font-semibold text-slate-400">•</span>
              <span>
                <strong>GIS 공간 연산:</strong> 15m 허용 오차 기반 Haversine 거리 및 자석 스냅 좌표 흡착
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono font-semibold text-slate-400">•</span>
              <span>
                <strong>실시간 동기화:</strong> Supabase PostgreSQL 기반 무제한 트랜잭션 및 웹소켓 브로드캐스팅
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono font-semibold text-slate-400">•</span>
              <span>
                <strong>연계 포맷:</strong> 8차시 다익스트라 엔진 호환 단일 JSON 규격 (`campus_roads.json`)
              </span>
            </li>
          </ul>
        </section>
      </main>

      <footer className="py-6 mt-12 text-xs text-center border-t border-slate-200 bg-white/90 text-slate-500">
        <div className="flex flex-col items-center justify-between gap-2 px-5 mx-auto max-w-7xl sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="rounded bg-sky-50 px-2 py-0.5 font-mono font-bold text-sky-700 border border-sky-200">
              JH&apos;s SW Lab
            </span>
            <span>© 2026 JH&apos;s SW Lab 이진호 | 박유리 | 설재혁. All rights reserved.</span>
          </div>
          <div className="text-[11px] text-slate-400">
            운영 및 개발: <strong>JH&apos;s SW Lab</strong> · 문의: devlee92736@gmail.com
          </div>
        </div>
      </footer>
      
    </div>
  );
}
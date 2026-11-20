"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface SubmissionRow {
  student_number: number;
  student_name: string;
  module_file: string;
  func_name: string;
  harness_score: number;
  submitted_code: string;
  submitted_at: string;
}

const MODULE_FILES: Record<number, { team: string; file: string }> = {
  1: { team: "Team 1", file: "student_01_albedo.py" },
  2: { team: "Team 1", file: "student_02_solar.py" },
  3: { team: "Team 1", file: "student_03_radiation.py" },
  4: { team: "Team 1", file: "student_04_slope_dem.py" },
  5: { team: "Team 1", file: "student_05_failsafe.py" },
  6: { team: "Team 2", file: "student_06_step_test.py" },
  7: { team: "Team 2", file: "student_07_paps_weight.py" },
  8: { team: "Team 2", file: "student_08_ml_regression.py" },
  9: { team: "Team 2", file: "student_09_clamping.py" },
  10: { team: "Team 2", file: "student_10_target_hr.py" },
  11: { team: "Team 3", file: "student_11_topology.py" },
  12: { team: "Team 3", file: "student_12_normalizer.py" },
  13: { team: "Team 3", file: "student_13_joint_guard.py" },
  14: { team: "Team 3", file: "student_14_steep_cost.py" },
  15: { team: "Team 3", file: "student_15_dijkstra_core.py" },
  16: { team: "Team 4", file: "student_16_sidebar_ui.py" },
  17: { team: "Team 4", file: "student_17_privacy.py" },
  18: { team: "Team 4", file: "student_18_map_render.py" },
  19: { team: "Team 4", file: "student_19_metrics_table.py" },
  20: { team: "Team 4", file: "student_20_xai_explainer.py" },
};

export default function VibeSubmissionBoard({ classCode }: { classCode: string }) {
  const [completedMap, setCompletedMap] = useState<Record<number, SubmissionRow>>({});
  const [previewRow, setPreviewRow] = useState<SubmissionRow | null>(null);
  const [liveShareUrl, setLiveShareUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [resettingTarget, setResettingTarget] = useState<number | "ALL" | null>(null);

  const loadCompletions = useCallback(async () => {
    if (!isSupabaseConfigured() || !classCode) return;

    const { data } = await supabase
      .from("vibecoding_submissions")
      .select("*")
      .eq("class_code", classCode);

    const map: Record<number, SubmissionRow> = {};
    if (data) {
      data.forEach((row: any) => {
        map[row.student_number] = row;
      });
    }
    setCompletedMap(map);
  }, [classCode]);

  useEffect(() => {
    loadCompletions();

    if (!isSupabaseConfigured()) return;
    const channel = supabase
      .channel(`realtime:vibecoding_${classCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vibecoding_submissions",
          filter: `class_code=eq.${classCode}`,
        },
        () => {
          loadCompletions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classCode, loadCompletions]);

  const successCount = Object.keys(completedMap).length;
  const successRate = Math.round((successCount / 20) * 100);

  const handleCopyLiveShare = () => {
    if (!liveShareUrl.trim()) return;
    navigator.clipboard.writeText(liveShareUrl.trim());
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // 개별 학생 성공 기록 초기화
  const handleResetSingle = async (studentNum: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isSupabaseConfigured()) return;
    if (!confirm(`${studentNum}번 학생의 모듈 생성 성공 기록을 초기화하시겠습니까?`)) return;

    setResettingTarget(studentNum);
    try {
      const { error } = await supabase
        .from("vibecoding_submissions")
        .delete()
        .eq("class_code", classCode)
        .eq("student_number", studentNum);

      if (error) {
        alert("초기화 실패: " + error.message);
        return;
      }

      setCompletedMap((prev) => {
        const next = { ...prev };
        delete next[studentNum];
        return next;
      });
      if (previewRow?.student_number === studentNum) {
        setPreviewRow(null);
      }
    } finally {
      setResettingTarget(null);
    }
  };

  // 학급 전체 성공 기록 초기화
  const handleResetAll = async () => {
    if (!isSupabaseConfigured() || successCount === 0) return;
    if (
      !confirm(
        `[주의] ${classCode} 학급의 바이브 코딩 성공 기록 ${successCount}건을 모두 초기화하시겠습니까?`
      )
    )
      return;

    setResettingTarget("ALL");
    try {
      const { error } = await supabase
        .from("vibecoding_submissions")
        .delete()
        .eq("class_code", classCode);

      if (error) {
        alert("전체 초기화 실패: " + error.message);
        return;
      }

      setCompletedMap({});
      setPreviewRow(null);
    } finally {
      setResettingTarget(null);
    }
  };

  return (
    <div className="p-5 space-y-4 bg-white border shadow-sm rounded-xl border-slate-200">
      {/* 상단 헤더: 성공률, 진행 바, 전체 초기화 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <span className="font-mono text-[11px] font-bold text-emerald-600">
            7차시 바이브 코딩 & VS Code Live Share 협업 관제
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            20인 전담 모듈 생성 성공률 및 실시간 현황
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="font-mono text-right">
            <span className="text-[11px] text-slate-400 block font-sans">모듈 생성 성공률</span>
            <span className="text-sm font-black text-emerald-700">
              {successRate}% ({successCount} / 20명 완료)
            </span>
          </div>
          <div className="w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full transition-all duration-500 bg-emerald-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
          {successCount > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              disabled={resettingTarget === "ALL"}
              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {resettingTarget === "ALL" ? "초기화 중..." : "성공 기록 전체 초기화"}
            </button>
          )}
        </div>
      </div>

      {/* VS Code Live Share 세션 링크 관리 바 */}
      <div className="flex flex-col gap-2 p-3 border border-indigo-100 rounded-lg bg-indigo-50/50 sm:flex-row sm:items-center">
        <span className="font-mono text-xs font-bold text-indigo-800 whitespace-nowrap">
          VS Code Live Share 링크:
        </span>
        <input
          type="text"
          value={liveShareUrl}
          onChange={(e) => setLiveShareUrl(e.target.value)}
          placeholder="https://prod.liveshare.vsengsaas.visualstudio.com/join?..."
          className="flex-1 rounded border border-indigo-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCopyLiveShare}
          disabled={!liveShareUrl.trim()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:bg-slate-300 whitespace-nowrap"
        >
          {copiedUrl ? "링크 복사됨" : "공유 링크 복사"}
        </button>
      </div>

      {/* 1~20번 모듈 성공 현황 그리드 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
          const item = completedMap[num];
          const mod = MODULE_FILES[num];
          const isResettingThis = resettingTarget === num;

          return (
            <div
              key={num}
              onClick={() => item && setPreviewRow(item)}
              className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition ${
                item
                  ? "border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/70 cursor-pointer"
                  : "border-slate-200 bg-slate-50/60 opacity-65 cursor-default"
              }`}
            >
              <div className="flex items-center justify-between w-full font-mono text-[11px] gap-1">
                <span className="font-bold truncate text-slate-800">
                  {num}번 <span className="text-[10px] font-normal text-slate-400">({mod.team})</span>
                </span>
                {item ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                      성공
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleResetSingle(num, e)}
                      disabled={isResettingThis}
                      title={`${num}번 성공 기록 초기화`}
                      className="rounded border border-rose-200 bg-white px-1 py-0.2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {isResettingThis ? "..." : "삭제"}
                    </button>
                  </div>
                ) : (
                  <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-500 shrink-0">
                    진행 중
                  </span>
                )}
              </div>
              <span className="mt-1 w-full truncate font-mono text-[10px] text-slate-600">
                {mod.file}
              </span>
            </div>
          );
        })}
      </div>

      {/* 성공한 모듈 코드 확인 미리보기 */}
      {previewRow && (
        <div className="p-4 space-y-2 border rounded-lg border-slate-300 bg-slate-900 text-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 font-mono text-xs border-b border-slate-700">
            <span className="font-bold text-emerald-400">
              [{previewRow.student_number}번 {previewRow.student_name}] {previewRow.module_file} (하네스 {previewRow.harness_score}점 통과)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleResetSingle(previewRow.student_number)}
                className="rounded bg-rose-900/80 border border-rose-700 px-2.5 py-0.5 text-[11px] text-rose-200 hover:bg-rose-800"
              >
                이 학생 기록 삭제
              </button>
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="rounded bg-slate-800 px-2.5 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
          <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-5 text-emerald-300">
            <code>{previewRow.submitted_code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
"use client";

import React, { useState, useEffect, useRef } from "react";
import TopNavBar from "@/components/nav/TopNavBar";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  harnessScore?: number;
  usedModel?: string;
}

const STUDENT_MODULE_INFO: Record<
  number,
  { team: string; teamFolder: string; file: string; func: string; desc: string }
> = {
  1: { team: "Team 1", teamFolder: "team1", file: "student_01_albedo.py", func: "get_surface_albedo()", desc: "노면 피복별 반사율(알베도) 매핑" },
  2: { team: "Team 1", teamFolder: "team1", file: "student_02_solar.py", func: "calculate_effective_solar()", desc: "가로수 그늘 차광률(70%) 및 유효 일사량 연산" },
  3: { team: "Team 1", teamFolder: "team1", file: "student_03_radiation.py", func: "calculate_absorbed_radiation()", desc: "지표면 순흡수 복사에너지 R_abs 계산" },
  4: { team: "Team 1", teamFolder: "team1", file: "student_04_slope_dem.py", func: "compute_edge_slope()", desc: "고도차 기반 간선 경사도(%) 계산" },
  5: { team: "Team 1", teamFolder: "team1", file: "student_05_failsafe.py", func: "check_weather_failsafe()", desc: "33°C 폭염 야외 주행 강제 차단 인터락" },
  6: { team: "Team 2", teamFolder: "team2", file: "student_06_step_test.py", func: "calculate_base_delta_hr()", desc: "3분 스텝검사 기초 심박 상승치 산출" },
  7: { team: "Team 2", teamFolder: "team2", file: "student_07_paps_weight.py", func: "get_paps_strain_factor()", desc: "PAPS 등급/체중별 운동 부하 계수" },
  8: { team: "Team 2", teamFolder: "team2", file: "student_08_ml_regression.py", func: "predict_ml_bpm_gain()", desc: "ML 다중회귀 OLS 기반 심박 상승치 추론" },
  9: { team: "Team 2", teamFolder: "team2", file: "student_09_clamping.py", func: "clamp_physiological_bpm()", desc: "220 BPM 생체 한계선 클램핑 보호" },
  10: { team: "Team 2", teamFolder: "team2", file: "student_10_target_hr.py", func: "evaluate_target_hr_zone()", desc: "카보넨 공식 유효 유산소 심박수 판정" },
  11: { team: "Team 3", teamFolder: "team3", file: "student_11_topology.py", func: "validate_campus_graph()", desc: "그래프 단절·고립 노드 위상 무결성 검증" },
  12: { team: "Team 3", teamFolder: "team3", file: "student_12_normalizer.py", func: "min_max_normalize()", desc: "이종 데이터 Min-Max 0~1 선형 정규화" },
  13: { team: "Team 3", teamFolder: "team3", file: "student_13_joint_guard.py", func: "get_surface_joint_penalty()", desc: "노면 충격량 관절 보호 페널티 산정" },
  14: { team: "Team 3", teamFolder: "team3", file: "student_14_steep_cost.py", func: "calculate_slope_strain_penalty()", desc: "급경사(>5%) 비선형 페널티 계산" },
  15: { team: "Team 3", teamFolder: "team3", file: "student_15_dijkstra_core.py", func: "compute_final_dijkstra_edge_cost()", desc: "음수 비용 방어(max 0.1) 다익스트라 코어" },
  16: { team: "Team 4", teamFolder: "team4", file: "student_16_sidebar_ui.py", func: "validate_route_selection()", desc: "사이드바 설정 및 동일 노드 방어 인터락" },
  17: { team: "Team 4", teamFolder: "team4", file: "student_17_privacy.py", func: "mask_coordinates_privacy()", desc: "차분 프라이버시 GPS 노이즈 오프셋" },
  18: { team: "Team 4", teamFolder: "team4", file: "student_18_map_render.py", func: "get_path_render_style()", desc: "3대 추천 경로 다색 렌더링 스타일 지정" },
  19: { team: "Team 4", teamFolder: "team4", file: "student_19_metrics_table.py", func: "build_comparison_metrics()", desc: "거리·고도·심박 3단 비교 카드 지표 생성" },
  20: { team: "Team 4", teamFolder: "team4", file: "student_20_xai_explainer.py", func: "generate_xai_explanation()", desc: "언덕길 우회 사유 설명 XAI 패널 생성" },
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3.5 py-1.5 text-[11px] font-mono text-slate-400">
        <span className="font-bold text-sky-400">{language.toUpperCase()}</span>
        <button
          onClick={handleCopy}
          className="rounded bg-slate-800 px-2.5 py-0.5 text-[10px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
        >
          {copied ? "복사 완료" : "코드 복사"}
        </button>
      </div>

      <pre className="overflow-x-auto p-3.5 font-mono text-[11.5px] leading-5 text-emerald-300 selection:bg-slate-700">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedChatContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-1.5 leading-relaxed">
      {parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          let language = "python";
          let codeBody = "";

          if (lines[0] && /^[a-zA-Z0-9_-]+$/.test(lines[0].trim())) {
            language = lines[0].trim();
            codeBody = lines.slice(1).join("\n");
          } else {
            codeBody = lines.join("\n");
          }

          return <CodeBlock key={idx} code={codeBody} language={language} />;
        }

        return (
          <p key={idx} className="font-sans text-xs whitespace-pre-wrap">
            {part}
          </p>
        );
      })}
    </div>
  );
}

function extractPythonCode(text: string): string | null {
  const match = text.match(/```(?:python)?\s*([\s\S]*?)```/i);
  return match && match[1] ? match[1].trim() : null;
}

export default function VibeCodingPage() {
  const [classCode, setClassCode] = useState<string>("CLASS_2026_A");
  const [userRole, setUserRole] = useState<"teacher" | "student">("student");
  const [studentName, setStudentName] = useState<string>("1번 학생");
  const [studentId, setStudentId] = useState<number>(1);
  const [isStudentLocked, setIsStudentLocked] = useState<boolean>(false);

  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentScore, setCurrentScore] = useState<number>(0);

  const [completedCode, setCompletedCode] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [copiedSidebar, setCopiedSidebar] = useState<boolean>(false);

  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "error">("checking");
  const [statusMessage, setStatusMessage] = useState<string>("JINMINI 엔진 확인 중...");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const curModule = STUDENT_MODULE_INFO[studentId] || STUDENT_MODULE_INFO[1];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("papsrun_user");
      if (saved) {
        const user = JSON.parse(saved);
        if (user.classCode && user.classCode !== "ALL") setClassCode(user.classCode);
        if (user.role) setUserRole(user.role);
        if (user.name) setStudentName(user.name);

        if (user.role === "student" && user.studentNumber) {
          const mappedNum = ((Number(user.studentNumber) - 1) % 20) + 1;
          setStudentId(mappedNum);
          setIsStudentLocked(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const checkCompletion = async () => {
      const { data } = await supabase
        .from("vibecoding_submissions")
        .select("submitted_code, harness_score")
        .eq("class_code", classCode)
        .eq("student_number", studentId)
        .maybeSingle();

      if (data) {
        setCompletedCode(data.submitted_code);
        setIsCompleted(true);
        setCurrentScore((prev) => Math.max(prev, Number(data.harness_score ?? 0)));
      } else {
        setCompletedCode(null);
        setIsCompleted(false);
      }
    };
    checkCompletion();
  }, [classCode, studentId]);

  const getInitialGreeting = (sId: number): string => {
    const info = STUDENT_MODULE_INFO[sId] || STUDENT_MODULE_INFO[1];
    return `안녕! 나는 오늘 네 바이브 코딩을 함께할 AI 튜터 **진미나이(JINMINI)**야.\n\n너는 **${sId}번 학생**으로서 **${info.team}**의 \`${info.func}\` 모듈 개발을 맡았어.\n(${info.desc})\n\n역할, 물리·생체 지표, 예외 방어 조건, 출력 형식을 모두 갖춘 **4점 만점 프롬프트**를 작성해 주면 내가 곧바로 네 전담 완성 코드를 생성해 줄게!`;
  };

  useEffect(() => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setMessages([
      {
        id: `init_${Date.now()}`,
        role: "assistant",
        content: getInitialGreeting(studentId),
        isStreaming: false,
      },
    ]);
    setCurrentScore(0);
    setIsLoading(false);
  }, [studentId]);

  useEffect(() => {
    async function checkApi() {
      try {
        const res = await fetch("/api/vibecoding/health");
        const data = await res.json();
        if (res.ok && data.status === "ok") {
          setApiStatus("connected");
          setStatusMessage("JINMINI 엔진 연결 정상");
        } else {
          setApiStatus("error");
          setStatusMessage("JINMINI 오프라인");
        }
      } catch {
        setApiStatus("error");
        setStatusMessage("네트워크 응답 없음");
      }
    }
    checkApi();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const recordModuleCompletion = async (codeText: string, score: number) => {
    setCompletedCode(codeText);
    setIsCompleted(true);

    if (!isSupabaseConfigured()) return;
    try {
      await supabase.from("vibecoding_submissions").upsert(
        {
          class_code: classCode,
          student_number: studentId,
          student_name: userRole === "student" ? studentName : `${studentId}번 학생`,
          module_file: curModule.file,
          func_name: curModule.func,
          harness_score: score,
          submitted_code: codeText,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "class_code,student_number" }
      );
    } catch (e) {
      console.error("완료 기록 저장 실패:", e);
    }
  };

  const streamText = (fullText: string, messageId: string, meta: { score?: number; model?: string }) => {
    if (!fullText) {
      setIsLoading(false);
      return;
    }

    let index = 0;
    const chunkSize = 6;
    const speed = 5;

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    typingTimerRef.current = setInterval(() => {
      index += chunkSize;
      const currentChunk = fullText.slice(0, index);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: currentChunk,
                isStreaming: index < fullText.length,
                usedModel: meta.model,
              }
            : msg
        )
      );

      if (index >= fullText.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
        setIsLoading(false);
      }
    }, speed);
  };

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || isLoading) return;

    const userMsg = inputPrompt;
    setInputPrompt("");

    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `ai_${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: userMsg },
      { id: assistantMessageId, role: "assistant", content: "", isStreaming: true },
    ]);

    setIsLoading(true);

    try {
      const historyToSend = messages
        .filter((m) => !m.id.startsWith("init_") && m.content.trim() !== "")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/vibecoding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          userPrompt: userMsg,
          chatHistory: historyToSend,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const nextScore = data.harnessScore ?? 0;
        setCurrentScore(nextScore);
        setApiStatus("connected");
        setStatusMessage("JINMINI 엔진 연결 정상");

        // 4점 만점 달성으로 정답 코드가 반환된 경우 자동 완료 처리
        const extracted = extractPythonCode(data.reply || "");
        if (extracted && (data.isFinalDelivered || nextScore >= 4)) {
          await recordModuleCompletion(extracted, nextScore);
        }

        streamText(data.reply || "", assistantMessageId, {
          score: nextScore,
          model: data.usedModel,
        });
      } else {
        alert(data.error || "응답 생성 실패");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
        setApiStatus("error");
        setIsLoading(false);
      }
    } catch {
      alert("진미나이 서버와 통신할 수 없습니다.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
      setApiStatus("error");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInsertHarnessSample = () => {
    setInputPrompt(
      `[역할]: ${curModule.team} 소속으로 ${curModule.desc}를 구현하는 학생 개발자\n` +
      `[전담 함수]: ${curModule.func}\n` +
      `[핵심 요구사항]: 1~5차시 지형·물리 변수를 반영하고, 결측치나 0 이하 이상치를 방어하도록 설계\n` +
      `[출력 형식]: Python 함수 정의 및 입출력 타입 힌트 명시`
    );
  };

  const handleCopyCompletedCode = () => {
    if (!completedCode) return;
    navigator.clipboard.writeText(completedCode);
    setCopiedSidebar(true);
    setTimeout(() => setCopiedSidebar(false), 2000);
  };

  return (
    <div className="flex flex-col w-screen h-screen font-sans bg-slate-50">
      <TopNavBar currentPath="/vibecoding" />

      {/* 상태 헤더 바 */}
      <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-sky-600">7차시 [정보·공학]</span>
          <span className="text-xs text-slate-300">|</span>
          <span className="text-xs font-bold text-slate-800">
            진미나이(JINMINI) AI 바이브 코딩 실습실
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 font-mono text-xs border rounded-full border-slate-200 bg-slate-50">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full transition-all ${
              apiStatus === "connected"
                ? "bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"
                : apiStatus === "error"
                ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                : "bg-slate-400"
            }`}
          />
          <span
            className={`font-semibold ${
              apiStatus === "connected"
                ? "text-emerald-700"
                : apiStatus === "error"
                ? "text-rose-700 font-bold"
                : "text-slate-500"
            }`}
          >
            {statusMessage}
          </span>
        </div>
      </div>

      <main className="flex flex-1 overflow-hidden">
        {/* 좌측 패널: 학생 배정 및 프롬프트 점수 */}
        <aside className="p-4 space-y-4 overflow-y-auto bg-white border-r w-80 border-slate-200">
          <div className="p-3 space-y-2 border rounded-xl border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                학생 번호 & 전담 모듈
              </label>
              {isStudentLocked && (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-700">
                  자동 배정됨
                </span>
              )}
            </div>

            <select
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
              disabled={isLoading || isStudentLocked}
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
                const info = STUDENT_MODULE_INFO[num];
                return (
                  <option key={num} value={num}>
                    {num}번 학생 ({info.file})
                  </option>
                );
              })}
            </select>

            <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-2.5 space-y-1 text-xs">
              <div className="font-bold text-sky-900">{curModule.team} 전담 과제</div>
              <div className="font-mono text-[11px] font-bold text-sky-700">{curModule.func}</div>
              <div className="text-[11px] text-slate-600">{curModule.desc}</div>
              <div className="text-[10px] text-slate-400 font-mono pt-1">
                대상 경로: {curModule.teamFolder}/{curModule.file}
              </div>
            </div>

            {/* 모듈 생성 성공 상태 및 VS Code Live Share 붙여넣기 안내 */}
            {isCompleted && completedCode ? (
              <div className="pt-1 space-y-1.5">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-emerald-900">
                  <strong>모듈 생성 성공!</strong> 코드를 복사한 뒤 <strong>VS Code Live Share</strong>의 <code className="font-mono font-bold">{curModule.teamFolder}/{curModule.file}</code> 파일에 붙여넣으세요.
                </div>
                <button
                  onClick={handleCopyCompletedCode}
                  className="w-full rounded-md bg-emerald-600 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  {copiedSidebar ? "코드 복사 완료" : `${curModule.file} 코드 복사하기`}
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500">
                진행 중 (4점 만점 프롬프트 입력 시 완성 코드가 자동 생성됩니다)
              </div>
            )}
          </div>

          {/* 프롬프트 점수 카드 */}
          <div className="p-3 space-y-2 border border-indigo-100 rounded-xl bg-indigo-50/60">
            <span className="block text-xs font-bold text-indigo-900">
              내 프롬프트 완성도
            </span>
            <div className="flex items-center gap-2">
              <div className="font-mono text-2xl font-black text-indigo-600">
                {currentScore} / 4점
              </div>
              <span className="text-[11px] font-semibold text-slate-600">
                {currentScore <= 1
                  ? "[단순 지시]"
                  : currentScore < 4
                  ? "[보완 필요]"
                  : "[4점 만점 - 완성]"}
              </span>
            </div>
            <ul className="text-[10px] text-slate-500 space-y-1 border-t border-indigo-100/70 pt-2">
              <li>• 역할/페르소나 명시 여부</li>
              <li>• 1·5차시 지형·물리 지표 포함 여부</li>
              <li>• 제약 조건 및 이상치 방어 명시</li>
              <li>• Python 함수 입출력 형식 명시</li>
            </ul>
          </div>

          {/* 프롬프트 예시 템플릿 */}
          <div className="p-3 space-y-2 border rounded-xl border-slate-200 bg-slate-50">
            <span className="block text-xs font-bold text-slate-700">
              프롬프트 작성 가이드
            </span>
            <button
              onClick={() => setInputPrompt("이 함수 코드 그냥 바로 짜줘.")}
              className="w-full text-left rounded border border-rose-200 bg-rose-50/70 p-2 text-[11px] text-rose-800 hover:bg-rose-100"
            >
              <strong>부실 프롬프트 예시</strong>: "이 함수 코드 짜줘"
            </button>
            <button
              onClick={handleInsertHarnessSample}
              className="w-full text-left rounded border border-emerald-200 bg-emerald-50/70 p-2 text-[11px] text-emerald-800 hover:bg-emerald-100"
            >
              <strong>4점 만점 프롬프트 예시</strong>: 역할, 제약조건, 입출력 명세
            </button>
          </div>
        </aside>

        {/* 우측 채팅창 */}
        <section className="flex flex-col flex-1 bg-white">
          <div ref={chatContainerRef} className="flex-1 p-5 space-y-4 overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 font-mono">
                  <span>
                    {msg.role === "user"
                      ? `${studentId}번 학생`
                      : "진미나이(JINMINI)"}
                  </span>
                  {msg.usedModel && (
                    <span className="px-1 font-bold rounded bg-sky-50 text-sky-600">
                      [{msg.usedModel}]
                    </span>
                  )}
                </div>
                <div
                  className={`max-w-3xl rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-sky-600 text-white rounded-br-none whitespace-pre-wrap font-mono"
                      : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/80 font-sans"
                  }`}
                >
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <FormattedChatContent content={msg.content} />
                  )}

                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-sky-500 animate-pulse ml-1 align-middle" />
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content === "" && (
              <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                진미나이가 프롬프트를 분석하고 있습니다...
              </div>
            )}
          </div>

          {/* 하단 단일 입력창 */}
          <div className="p-4 space-y-2 border-t border-slate-200 bg-slate-50">
            <div className="flex gap-2">
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`${curModule.func} 모듈을 구현하기 위한 4점 만점 프롬프트를 작성하세요... (Enter: 전송 / Shift+Enter: 줄바꿈)`}
                rows={3}
                className="flex-1 p-3 font-mono text-xs bg-white border resize-none rounded-xl border-slate-300 focus:border-sky-500 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputPrompt.trim()}
                className="text-xs font-bold text-white transition shadow-sm w-36 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300"
              >
                {isLoading ? "생성 중..." : "프롬프트 전송"}
              </button>
            </div>
            <div className="text-[10px] text-slate-400 font-mono text-right">
              Tip: <kbd className="rounded bg-slate-200 px-1 py-0.5 text-slate-600">Enter</kbd> 전송 | <kbd className="rounded bg-slate-200 px-1 py-0.5 text-slate-600">Shift + Enter</kbd> 줄바꿈
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
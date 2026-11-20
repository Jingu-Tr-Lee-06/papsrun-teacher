"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import TopNavBar from "@/components/nav/TopNavBar";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"student_login" | "teacher_login" | "teacher_signup">("student_login");

  const [classCode, setClassCode] = useState("CLASS_2026_A");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [teacherName, setTeacherName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const payload =
        mode === "teacher_signup"
          ? { action: "register_teacher", loginId, password, name: teacherName, classCode }
          : { action: "login", loginId: loginId.trim().toLowerCase(), password: password.trim() };

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "인증에 실패했습니다.");
        setLoading(false);
        return;
      }

      localStorage.setItem("papsrun_user", JSON.stringify(data.user));

      if (data.user.role === "teacher") {
        router.push("/admin");
      } else {
        router.push("/workspace");
      }
      router.refresh();
    } catch {
      setErrorMsg("서버와 통신할 수 없습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-slate-50">
      <TopNavBar currentPath="/login" />

      <main className="flex items-center justify-center flex-1 p-6">
        <div className="w-full max-w-md bg-white border shadow-lg rounded-2xl border-slate-200 p-7">
          <div className="text-center">
            <span className="inline-block rounded-full bg-sky-50 px-3 py-1 font-mono text-[11px] font-bold text-sky-600">
              PAPSrun 통합 인증
            </span>
            <h1 className="mt-2 text-xl font-extrabold text-slate-900">
              {mode === "student_login"
                ? "학생 실습실 로그인"
                : mode === "teacher_login"
                ? "교사 관제 센터 로그인"
                : "교사 신규 회원가입"}
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 mt-5 text-xs font-bold rounded-lg bg-slate-100">
            <button
              type="button"
              onClick={() => { setMode("student_login"); setErrorMsg(""); setLoginId(""); setPassword(""); }}
              className={`rounded-md py-2 transition ${
                mode === "student_login" ? "bg-white text-sky-600 shadow-sm" : "text-slate-500"
              }`}
            >
              🎓 학생 로그인
            </button>
            <button
              type="button"
              onClick={() => { setMode("teacher_login"); setErrorMsg(""); setLoginId(""); setPassword(""); }}
              className={`rounded-md py-2 transition ${
                mode === "teacher_login" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
              }`}
            >
              🧑‍🏫 교사 로그인
            </button>
            <button
              type="button"
              onClick={() => { setMode("teacher_signup"); setErrorMsg(""); setLoginId(""); setPassword(""); }}
              className={`rounded-md py-2 transition ${
                mode === "teacher_signup" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
              }`}
            >
              ✨ 교사 가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
            {mode === "teacher_signup" && (
              <>
                <div>
                  <label className="block mb-1 font-bold text-slate-700">교사 성명</label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="예: 홍길동 선생님"
                    required
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-700">담당 학급 코드 생성</label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    placeholder="예: CLASS_2026_A"
                    required
                    className="w-full px-3 py-2 font-mono uppercase border rounded-lg border-slate-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block mb-1 font-bold text-slate-700">
                {mode === "student_login" ? "발급받은 학생 아이디" : "교사 아이디"}
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder={mode === "student_login" ? "예: run01-482" : "teacher_id"}
                required
                className="w-full px-3 py-2 font-mono border rounded-lg border-slate-300 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">
                {mode === "student_login" ? "비밀번호 (5자리)" : "비밀번호"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "student_login" ? "예: k7m2p" : "비밀번호 입력"}
                required
                className="w-full px-3 py-2 font-mono border rounded-lg border-slate-300 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-semibold text-rose-700">
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:bg-slate-300"
            >
              {loading
                ? "처리 중..."
                : mode === "teacher_signup"
                ? "교사 계정 등록 및 시작하기"
                : "로그인"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
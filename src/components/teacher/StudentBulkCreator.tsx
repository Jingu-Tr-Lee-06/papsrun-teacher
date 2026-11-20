"use client";

import React, { useState, useEffect, useCallback } from "react";

interface StudentAccount {
  id: string;
  login_id: string;
  plain_password?: string;
  name: string;
  class_code: string;
  student_number: number;
}

export default function StudentBulkCreator({ defaultClassCode = "CLASS_2026_A" }: { defaultClassCode?: string }) {
  const [classCode, setClassCode] = useState(defaultClassCode);
  const [count, setCount] = useState(20);
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setClassCode(defaultClassCode);
  }, [defaultClassCode]);

  const fetchStudents = useCallback(async (signal?: AbortSignal) => {
    if (!classCode.trim()) return;
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/auth/bulk-students?classCode=${encodeURIComponent(classCode)}`,
        { signal }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setFetchError(errData.error || `목록 조회 실패 (${res.status})`);
        return;
      }
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.warn("학생 목록 조회 중 일시적 네트워크 오류:", err);
      setFetchError("서버와 일시적으로 연결할 수 없습니다. 잠시 후 새로고침을 눌러주세요.");
    }
  }, [classCode]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStudents(controller.signal);
    return () => controller.abort();
  }, [fetchStudents]);

  const handleBulkCreate = async () => {
    if (!confirm(`${classCode} 학급에 개별 랜덤 아이디·비밀번호를 가진 학생 계정 ${count}개를 추가 생성하시겠습니까?`)) return;
    setIsCreating(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/auth/bulk-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode, count }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        await fetchStudents();
      } else {
        alert(data.error || "생성 실패");
      }
    } catch (err) {
      console.error("일괄 생성 네트워크 오류:", err);
      alert("서버와 통신할 수 없습니다. 개발 서버 상태를 확인해 주세요.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadCredentialsCsv = () => {
    if (students.length === 0) return;
    const headers = ["학급코드", "번호", "이름", "개별_아이디", "개별_비밀번호(5자리)"];
    const rows = students.map((s) =>
      [s.class_code, s.student_number, s.name, s.login_id, s.plain_password || "****"].join(",")
    );
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `학생계정배부표_${classCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSingle = async (student: StudentAccount) => {
    if (!confirm(`[${student.login_id}] (${student.name}) 계정을 삭제하시겠습니까?`)) return;
    setDeletingId(student.id);
    try {
      const res = await fetch(`/api/auth/bulk-students?id=${encodeURIComponent(student.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== student.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "삭제 실패");
      }
    } catch (err) {
      console.error("개별 삭제 오류:", err);
      alert("삭제 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllInClass = async () => {
    if (students.length === 0) return;
    if (!confirm(`[경고] ${classCode} 학급의 학생 계정 ${students.length}개를 모두 삭제하시겠습니까?`)) return;
    setDeletingId("ALL");
    try {
      const res = await fetch(`/api/auth/bulk-students?classCode=${encodeURIComponent(classCode)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStudents([]);
        alert(data.message);
      } else {
        alert(data.error || "전체 삭제 실패");
      }
    } catch (err) {
      console.error("전체 삭제 오류:", err);
      alert("전체 삭제 중 네트워크 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-5 space-y-4 bg-white border shadow-sm rounded-xl border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <span className="font-mono text-[11px] font-bold text-indigo-600">개별 랜덤 계정 발급기</span>
          <h3 className="text-sm font-bold text-slate-900">학생 고유 아이디·비밀번호 일괄 생성 및 관리</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            학생마다 겹치지 않는 짧은 아이디(예: <code className="font-bold text-indigo-600">run01-482</code>)와 5자리 비밀번호가 자동 부여됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-600">
            발급됨: {students.length}명
          </span>
          {students.length > 0 && (
            <>
              <button
                onClick={handleDownloadCredentialsCsv}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                학생 배부용 CSV 다운로드
              </button>
              <button
                onClick={handleDeleteAllInClass}
                disabled={deletingId === "ALL"}
                className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {deletingId === "ALL" ? "삭제 중..." : "학급 전체 삭제"}
              </button>
            </>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center justify-between px-3 py-2 text-xs border rounded-lg border-amber-200 bg-amber-50 text-amber-800">
          <span>{fetchError}</span>
          <button
            onClick={() => fetchStudents()}
            className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
          >
            다시 시도
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
        <div>
          <label className="block mb-1 font-semibold text-slate-600">대상 학급 코드</label>
          <input
            type="text"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value.toUpperCase())}
            className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono uppercase"
          />
        </div>
        <div>
          <label className="block mb-1 font-semibold text-slate-600">추가 발급 인원수 (명)</label>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleBulkCreate}
            disabled={isCreating}
            className="w-full py-2 font-bold text-white transition bg-indigo-600 rounded hover:bg-indigo-700 disabled:bg-slate-300"
          >
            {isCreating ? "개별 계정 생성 중..." : `개별 랜덤 계정 ${count}개 발급`}
          </button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="overflow-y-auto border rounded-lg max-h-64 border-slate-200">
          <table className="w-full font-mono text-xs text-left">
            <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">번호</th>
                <th className="px-3 py-2">구분</th>
                <th className="px-3 py-2">발급 아이디 (ID)</th>
                <th className="px-3 py-2">개별 비밀번호 (5자리)</th>
                <th className="px-3 py-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-bold text-indigo-600">{st.student_number}번</td>
                  <td className="px-3 py-1.5 text-slate-600">{st.name}</td>
                  <td className="px-3 py-1.5 font-bold text-slate-900 select-all">{st.login_id}</td>
                  <td className="px-3 py-1.5">
                    <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-bold text-amber-800 select-all">
                      {st.plain_password || "****"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => handleDeleteSingle(st)}
                      disabled={deletingId === st.id}
                      className="rounded border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      {deletingId === st.id ? "삭제 중" : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
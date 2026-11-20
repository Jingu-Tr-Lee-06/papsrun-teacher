import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

function hashPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

// 헷갈리는 문자(0, o, 1, i, l)를 제외한 짧은 랜덤 문자열 생성기
function generateShortRandom(length: number, charset: string): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

// 학생별 고유 ID 생성 (예: run01-482, 총 9자)
function createUniqueStudentId(studentNum: number): string {
  const paddedNum = String(studentNum).padStart(2, "0");
  const randomDigits = generateShortRandom(3, "23456789");
  return `run${paddedNum}-${randomDigits}`;
}

// 학생별 짧은 랜덤 비밀번호 생성 (예: k7m2p, 영소문자+숫자 5자)
function createShortPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return generateShortRandom(5, chars);
}

// 학급 소속 학생 목록 조회
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classCode = searchParams.get("classCode");

  if (!classCode) {
    return NextResponse.json({ error: "학급 코드가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("papsrun_users")
    .select("id, login_id, plain_password, name, class_code, student_number, created_at")
    .eq("class_code", classCode.trim().toUpperCase())
    .eq("role", "student")
    .order("student_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ students: data || [] });
}

// 학생 계정 개별 랜덤 일괄 생성 (1번 ~ count번)
export async function POST(req: NextRequest) {
  try {
    const { classCode, count } = await req.json();

    if (!classCode || !count) {
      return NextResponse.json({ error: "학급 코드와 인원수를 입력하세요." }, { status: 400 });
    }

    const total = Math.min(Math.max(Number(count), 1), 50);
    const cleanClass = classCode.trim().toUpperCase();

    // 기존 번호와 겹치지 않도록 현재 학급의 마지막 번호 확인
    const { data: existingStudents } = await supabase
      .from("papsrun_users")
      .select("student_number")
      .eq("class_code", cleanClass)
      .eq("role", "student")
      .order("student_number", { ascending: false })
      .limit(1);

    const startNum = existingStudents && existingStudents.length > 0
      ? (existingStudents[0].student_number || 0) + 1
      : 1;

    const usedIds = new Set<string>();
    const rows = [];

    for (let i = 0; i < total; i++) {
      const num = startNum + i;
      let uniqueLoginId = createUniqueStudentId(num);
      while (usedIds.has(uniqueLoginId)) {
        uniqueLoginId = createUniqueStudentId(num);
      }
      usedIds.add(uniqueLoginId);

      const rawPassword = createShortPassword();

      rows.push({
        role: "student",
        login_id: uniqueLoginId,
        password_hash: hashPassword(rawPassword),
        plain_password: rawPassword,
        name: `${num}번 학생`,
        class_code: cleanClass,
        student_number: num,
      });
    }

    const { data, error } = await supabase
      .from("papsrun_users")
      .insert(rows)
      .select("id, login_id, plain_password, name, class_code, student_number");

    if (error) throw error;

    return NextResponse.json({
      message: `${cleanClass} 학급 학생 ${total}명(${startNum}번~${startNum + total - 1}번)의 개별 랜덤 계정이 발급되었습니다.`,
      students: data,
    });
  } catch (err: any) {
    console.error("Bulk Create Error:", err);
    return NextResponse.json({ error: err.message || "일괄 생성 실패" }, { status: 500 });
  }
}

// 학생 계정 개별 삭제 또는 학급 전체 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("id");
    const classCode = searchParams.get("classCode");

    if (studentId) {
      const { error } = await supabase
        .from("papsrun_users")
        .delete()
        .eq("id", studentId)
        .eq("role", "student");

      if (error) throw error;
      return NextResponse.json({ message: "선택한 학생 계정이 삭제되었습니다." });
    }

    if (classCode) {
      const { error } = await supabase
        .from("papsrun_users")
        .delete()
        .eq("class_code", classCode.trim().toUpperCase())
        .eq("role", "student");

      if (error) throw error;
      return NextResponse.json({ message: `${classCode} 학급의 모든 학생 계정이 삭제되었습니다.` });
    }

    return NextResponse.json({ error: "삭제 대상이 지정되지 않았습니다." }, { status: 400 });
  } catch (err: any) {
    console.error("Student Delete Error:", err);
    return NextResponse.json({ error: err.message || "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
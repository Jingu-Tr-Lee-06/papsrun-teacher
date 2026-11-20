import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

function hashPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, loginId, password, name, classCode } = body;

    // 1. 교사 회원가입
    if (action === "register_teacher") {
      if (!loginId || !password || !name || !classCode) {
        return NextResponse.json({ error: "모든 필드를 입력해 주세요." }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from("papsrun_users")
        .select("id")
        .eq("login_id", loginId.trim())
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
      }

      const { data: newUser, error } = await supabase
        .from("papsrun_users")
        .insert({
          role: "teacher",
          login_id: loginId.trim(),
          password_hash: hashPassword(password),
          name: name.trim(),
          class_code: classCode.trim().toUpperCase(),
        })
        .select()
        .single();

      if (error) throw error;

      const res = NextResponse.json({
        user: {
          id: newUser.id,
          role: newUser.role,
          loginId: newUser.login_id,
          name: newUser.name,
          classCode: newUser.class_code,
        },
      });

      res.cookies.set("papsrun_session", JSON.stringify({
        id: newUser.id,
        role: newUser.role,
        name: newUser.name,
        classCode: newUser.class_code,
      }), { path: "/", maxAge: 60 * 60 * 24 });

      return res;
    }

    // 2. 통합 로그인 (교사 & 학생)
    if (action === "login") {
      if (!loginId || !password) {
        return NextResponse.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
      }

      const { data: user, error } = await supabase
        .from("papsrun_users")
        .select("*")
        .eq("login_id", loginId.trim())
        .eq("password_hash", hashPassword(password))
        .maybeSingle();

      if (error || !user) {
        return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
      }

      const sessionPayload = {
        id: user.id,
        role: user.role,
        loginId: user.login_id,
        name: user.name,
        classCode: user.class_code,
        studentNumber: user.student_number,
      };

      const res = NextResponse.json({ user: sessionPayload });
      res.cookies.set("papsrun_session", JSON.stringify(sessionPayload), {
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      return res;
    }

    // 3. 로그아웃
    if (action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete("papsrun_session");
      return res;
    }

    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (err: any) {
    console.error("Auth API Error:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}
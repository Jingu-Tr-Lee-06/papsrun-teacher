import { NextRequest, NextResponse } from "next/server";

// 로그인 없이도 접근 허용할 공개 경로
const PUBLIC_PATHS = ["/", "/login"];

// 교사 권한(role === 'teacher')만 접근 가능한 경로
const TEACHER_ONLY_PATHS = ["/admin", "/teacher"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Next.js 내부 정적 파일, 이미지, API 요청은 미들웨어 통과
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. 공개 경로(/, /login)는 통과
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // 3. 쿠키에서 로그인 세션 확인
  const sessionCookie = req.cookies.get("papsrun_session")?.value;

  if (!sessionCookie) {
    // 비로그인 상태라면 무조건 /login 으로 강제 이동
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. 역할(Role) 기반 접근 제어 (학생이 교사 관제 센터에 들어가는 것 차단)
  try {
    const session = JSON.parse(sessionCookie);

    if (
      TEACHER_ONLY_PATHS.some((path) => pathname.startsWith(path)) &&
      session.role !== "teacher"
    ) {
      // 학생이 교사 페이지에 접근하려 하면 1차시 워크스페이스로 되돌려보냄
      return NextResponse.redirect(new URL("/workspace", req.url));
    }
  } catch {
    // 쿠키가 손상되었을 경우 삭제 후 로그인 페이지로 이동
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("papsrun_session");
    return res;
  }

  return NextResponse.next();
}

// 미들웨어가 감시할 경로 지정
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
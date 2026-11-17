import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  
  if (!hasKey) {
    return NextResponse.json({
      status: "error",
      message: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다."
    }, { status: 500 });
  }

  return NextResponse.json({
    status: "ok",
    message: "Gemini API 키 구성 정상"
  });
}
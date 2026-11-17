import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// 💡 2.5 계열(404) 제거 및 검증된 고속 최신 모델 순차 폴백
const LIVE_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite", // ⚡ 1순위: 2초대 안정적 성공 검증 모델
  "gemini-3.1-flash-lite", // ⚡ 2순위: 초경량 고속 백업
  "gemini-3.8-flash",      // 3순위: 최신 고성능 Flash
  "gemini-3.1-pro-preview" // 4순위: 심층 추론 Pro 백업
];

// 타임아웃을 6.5초(6500ms)로 설정하여 불필요한 연쇄 타임아웃 방지
const MODEL_TIMEOUT_MS = 6500;

/**
 * 타임아웃을 강제하여 무응답 시 즉시 다음 모델로 패스하는 래퍼
 */
async function callModelWithTimeout(model: string, params: { contents: any[]; config: any }) {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`TIMEOUT_${MODEL_TIMEOUT_MS}ms`));
    }, MODEL_TIMEOUT_MS);
  });

  const apiPromise = ai.models.generateContent({
    model,
    contents: params.contents,
    config: params.config,
  });

  try {
    const result: any = await Promise.race([apiPromise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * 모델 순차 시도 및 무응답/에러 시 즉시 다음 모델로 스위칭
 */
async function generateWithFallback(params: {
  contents: any[];
  systemInstruction: string;
  temperature?: number;
}) {
  let lastError: any = null;

  for (const model of LIVE_FALLBACK_MODELS) {
    const startTime = Date.now();
    try {
      console.log(`[JINMINI Engine] 모델 호출 시도: ${model}`);

      const response = await callModelWithTimeout(model, {
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.6,
        },
      });

      const elapsed = Date.now() - startTime;
      console.log(`[JINMINI Engine] ✅ 호출 성공: ${model} (${elapsed}ms 소요)`);
      return { text: response.text ?? "", usedModel: model };
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const isTimeout = err?.message?.includes("TIMEOUT");
      console.warn(
        `[JINMINI Fallback] ⏩ ${model} ${isTimeout ? `무응답 타임아웃(${elapsed}ms)` : "에러"}, 다음 모델로 전환. 사유:`,
        err?.message || err
      );
      lastError = err;
    }
  }

  throw new Error(`모든 JINMINI 모델 호출 실패 (마지막 오류: ${lastError?.message})`);
}

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { studentId, userPrompt, chatHistory, isFinalRequest } = body;

    if (!studentId || !userPrompt) {
      return NextResponse.json(
        { error: "학생 번호와 프롬프트를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    // 1. 하네스 점수 채점 (4대 기준)
    const hasRole = /paps|등급|러너|체력|특성|학생|개발자|역할/i.test(userPrompt);
    const hasMetrics = /경사|거리|복사열|알베도|고도|조도|r_abs|w_m2|피복/i.test(userPrompt);
    const hasConstraints = /이상|이하|회피|제한|우회|최소화|페널티|가중치|가중|방어|클램핑/i.test(userPrompt);
    const hasFormat = /함수|코드|가중치|cost|수식|다익스트라|python|def|return/i.test(userPrompt);

    const harnessScore = [hasRole, hasMetrics, hasConstraints, hasFormat].filter(Boolean).length;

    // 대화 이력 필터링 (빈 메시지 및 비정상 데이터 방어)
    const validHistory: any[] = [];
    if (Array.isArray(chatHistory)) {
      chatHistory.forEach((msg) => {
        if (
          msg &&
          typeof msg.content === "string" &&
          msg.content.trim() !== "" &&
          (msg.role === "user" || msg.role === "assistant" || msg.role === "model")
        ) {
          validHistory.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          });
        }
      });
    }

    const contents = [
      ...validHistory,
      { role: "user", parts: [{ text: String(userPrompt) }] },
    ];

    // 2. 최종 정답 코드 요청 분기 (하네스 점수 3점 이상 필요)
    if (isFinalRequest && harnessScore >= 3) {
      const num = parseInt(String(studentId).replace(/[^0-9]/g, ""), 10);
      const paddedId = String(num).padStart(2, "0");
      const finalDir = path.join(process.cwd(), "Final_code");

      let preassignedCode = "# 사전 배정된 학생 코드를 찾을 수 없습니다.";
      if (fs.existsSync(finalDir)) {
        const files = fs.readdirSync(finalDir);
        const matchedFile = files.find(
          (f) => f.startsWith(`student_${paddedId}_`) || f.startsWith(`student_${num}_`)
        );
        if (matchedFile) {
          preassignedCode = fs.readFileSync(path.join(finalDir, matchedFile), "utf-8");
        }
      }

      const systemInstruction = `
당신은 STEAM PAPSrun 7차시 AI 바이브 코딩 코칭 튜터 '진미나이(JINMINI)'입니다.
학생 ${num}번이 높은 수준의 프롬프트 하네스 엔지니어링(점수: ${harnessScore}/4)을 완수했습니다.
학생이 최종 제출을 요청했으므로, 아래에 제공되는 [학생 ${num}번 전담 정답 코드]를 반드시 마크다운 파이썬 코드 블록(\`\`\`python ... \`\`\`)으로 감싸서 있는 그대로 반환하세요.
코드 전후로 학생의 프롬프트에서 우수했던 하네스 설계 요소(역할, 지표, 제약조건)를 칭찬하고 격려하는 멘트를 간결하게 작성하세요.

[학생 ${num}번 전담 정답 코드]:
\`\`\`python
${preassignedCode}
\`\`\`
      `;

      const { text, usedModel } = await generateWithFallback({
        contents,
        systemInstruction,
        temperature: 0.2,
      });

      return NextResponse.json({
        reply: text,
        harnessScore,
        usedModel,
        isFinalDelivered: true,
      });
    }

    // 3. 소크라테스식 코칭 분기
    let tutorLevelInstruction = "";

    if (harnessScore <= 1) {
      tutorLevelInstruction = `
- 학생 프롬프트 수준: [초급 - 하네스 부실 (${harnessScore}/4)]
- 절대 완성 코드를 바로 주지 마세요.
- 소크라테스식 발문으로 누구(PAPS 등급/역할), 어떤 물리 지표(경사·거리·복사열 등), 어떤 제약조건이 빠졌는지 반문하여 프롬프트를 구체화하도록 간결하게 안내하세요.
      `;
    } else if (harnessScore === 2) {
      tutorLevelInstruction = `
- 학생 프롬프트 수준: [중급 - 기본 맥락 포함 (${harnessScore}/4)]
- 핵심 맥락은 있으나 구체적 제약 조건(경사도 몇 % 이상 회피, 결측치 방어 등)이나 함수 반환 형식이 부족합니다.
- 간단한 의사코드(Pseudocode) 힌트를 마크다운 코드 블록(\`\`\`python ... \`\`\`)으로 제시하고 조건을 명시하도록 피드백하세요.
      `;
    } else {
      tutorLevelInstruction = `
- 학생 프롬프트 수준: [고급 - 우수한 하네스 엔지니어링 (${harnessScore}/4)]
- 조건에 부합하는 모듈 함수 뼈대 예시 코드를 마크다운 코드 블록(\`\`\`python ... \`\`\`)으로 감싸 설명과 함께 제공하세요.
- 최종 정답 코드를 확정받으려면 '최종 정답 코드 받기' 버튼을 누르도록 유도하세요.
      `;
    }

    const systemInstruction = `
당신은 고등학교 STEAM PAPSrun 7차시 바이브 코딩 코칭 튜터 '진미나이(JINMINI)'입니다.
학생 번호: ${studentId}번
코드를 제시할 때는 반드시 마크다운 코드 블록(\`\`\`python ... \`\`\`)으로 감싸서 출력하세요.
[튜터링 모드]:
${tutorLevelInstruction}
    `;

    const { text, usedModel } = await generateWithFallback({
      contents,
      systemInstruction,
      temperature: 0.6,
    });

    return NextResponse.json({
      reply: text,
      harnessScore,
      usedModel,
      isFinalDelivered: false,
    });
  } catch (err: any) {
    console.error("JINMINI API 라우트 에러:", err);
    return NextResponse.json(
      { error: "진미나이 응답 생성 중 오류가 발생했습니다: " + err.message },
      { status: 500 }
    );
  }
}
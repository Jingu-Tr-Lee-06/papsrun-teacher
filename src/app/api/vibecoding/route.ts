import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

const LIVE_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-pro-preview",
];

const MODEL_TIMEOUT_MS = 10000;

function findStudentModuleCode(studentNum: number): {
  code: string;
  fileName: string;
  teamFolder: string;
} {
  const paddedId = String(studentNum).padStart(2, "0");
  const finalDir = path.join(process.cwd(), "Final_code");

  const teamIndex = Math.min(Math.max(Math.ceil(studentNum / 5), 1), 4);
  const expectedTeamFolder = `team${teamIndex}`;

  const searchDirs = [
    path.join(finalDir, expectedTeamFolder),
    path.join(finalDir, "team1"),
    path.join(finalDir, "team2"),
    path.join(finalDir, "team3"),
    path.join(finalDir, "team4"),
    finalDir,
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    const matchedFile = files.find(
      (f) =>
        f.endsWith(".py") &&
        (f.startsWith(`student_${paddedId}_`) || f.startsWith(`student_${studentNum}_`))
    );
    if (matchedFile) {
      const fullPath = path.join(dir, matchedFile);
      return {
        code: fs.readFileSync(fullPath, "utf-8"),
        fileName: matchedFile,
        teamFolder: path.basename(dir),
      };
    }
  }

  return {
    code: `# 사전 배정된 학생 코드를 찾을 수 없습니다. (경로 확인: Final_code/${expectedTeamFolder}/student_${paddedId}_*.py)`,
    fileName: `student_${paddedId}.py`,
    teamFolder: expectedTeamFolder,
  };
}

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

async function generateNaturalResponse(params: {
  contents: any[];
  systemInstruction: string;
}) {
  let lastError: any = null;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      roleEvidence: {
        type: Type.STRING,
        description: "학생이 직접 명시한 개발자 역할이나 프로젝트 소속/목적 문구. 없으면 빈 문자열('')",
      },
      hasRole: {
        type: Type.BOOLEAN,
        description: "roleEvidence가 실제로 존재하고 구체적일 때만 true",
      },
      metricsEvidence: {
        type: Type.STRING,
        description: "학생이 직접 언급한 도메인 변수(피복, 알베도, 경사, 심박 등)와 계산 방식 문구. 없으면 빈 문자열('')",
      },
      hasMetrics: {
        type: Type.BOOLEAN,
        description: "metricsEvidence가 실제로 존재하고 구체적일 때만 true",
      },
      constraintsEvidence: {
        type: Type.STRING,
        description: "학생이 직접 명시한 예외 상황 방어 조건(결측치, None, 오타/대소문자, 경계값, 음수/한계치 차단, 기본값 폴백 등). 막연한 기능 설명만 있고 예외·오류 방어 언급이 없으면 반드시 빈 문자열('')",
      },
      hasConstraints: {
        type: Type.BOOLEAN,
        description: "constraintsEvidence가 실제로 존재하고 예외 방어/제약 조건을 구체적으로 명시했을 때만 true. 단순 기능 요청만 있으면 반드시 false",
      },
      formatEvidence: {
        type: Type.STRING,
        description: "학생이 직접 지정한 Python 함수명, 입력 파라미터 자료형, 또는 반환값(float, dict 등) 형식 명세. 단순히 '계산하고 싶어' 수준이면 빈 문자열('')",
      },
      hasFormat: {
        type: Type.BOOLEAN,
        description: "formatEvidence가 실제로 존재하고 함수 시그니처나 입출력 데이터 형태를 명시했을 때만 true",
      },
      introCommentary: {
        type: Type.STRING,
        description:
          "학생에게 건네는 자연스럽고 상세한 AI 페어 프로그래머의 답변 본문. 점수나 채점 기준 같은 메타 용어는 절대 쓰지 말 것. 미완성 단계(하나라도 false)일 때는 3~4문단 이상으로 충분한 기술 설명과 구현 방향을 짚어주고, 빠진 부분(예외 방어 조건이나 함수 입출력 구조 등)을 어떻게 설계하면 좋을지 자연스럽게 질문할 것. 4개 모두 true일 때는 학생이 설계한 논리를 깊이 있게 공감·해설하는 도입부(2~3문단)를 작성할 것.",
      },
      outroExplanation: {
        type: Type.STRING,
        description:
          "4개 항목이 모두 true여서 완성 코드가 함께 제공될 때만 작성하는 상세 코드 해설 및 활용 가이드(3~4문단). 코드의 핵심 로직, 예외 방어 원리, 테스트 입력 예시, VS Code Live Share 적용 팁을 풍부하게 설명할 것. 미완성 단계일 때는 빈 문자열로 둘 것.",
      },
    },
    required: [
      "roleEvidence",
      "hasRole",
      "metricsEvidence",
      "hasMetrics",
      "constraintsEvidence",
      "hasConstraints",
      "formatEvidence",
      "hasFormat",
      "introCommentary",
      "outroExplanation",
    ],
  };

  for (const model of LIVE_FALLBACK_MODELS) {
    const startTime = Date.now();
    try {
      const response = await callModelWithTimeout(model, {
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: 0.5,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const rawText = response.text ?? "{}";
      const parsed = JSON.parse(rawText);
      return { result: parsed, usedModel: model };
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.warn(`[JINMINI Fallback] ${model} 전환 (${elapsed}ms):`, err?.message || err);
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
    const { studentId, userPrompt, chatHistory } = body;

    if (!studentId || !userPrompt) {
      return NextResponse.json(
        { error: "학생 번호와 프롬프트를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const num = parseInt(String(studentId).replace(/[^0-9]/g, ""), 10) || 1;
    const { code: preassignedCode, fileName, teamFolder } = findStudentModuleCode(num);

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

    const systemInstruction = `
당신은 고등학생과 함께 캠퍼스 러닝 최적화 프로젝트(PAPSrun)를 개발하는 AI 페어 프로그래머 '진미나이(JINMINI)'입니다.
현재 함께 작업 중인 동료는 ${num}번 학생이며, 맡은 모듈은 \`${teamFolder}/${fileName}\`입니다.

[매우 엄격한 내부 준비도 판정 규칙]:
학생이 작성한 **사용자 메시지(user 발화)**만을 근거로 아래 4가지 조건이 실제로 명시되었는지 엄격하게 판별하세요.
AI(당신)가 이전 대화에서 힌트로 먼저 언급한 내용은 학생이 직접 설계한 것으로 인정하지 마세요. 반드시 학생이 자기 메시지로 직접 요구한 내용만 근거(evidence)로 인정합니다.

1. hasRole: 학생이 자신의 개발자 역할, 팀 소속, 또는 시스템 내 역할을 명시했는가?
2. hasMetrics: 학생이 해당 모듈의 핵심 물리·생체·수리 변수와 처리 규칙을 구체적으로 설명했는가?
3. hasConstraints: 학생이 결측치(None), 오타/잘못된 입력, 경계값 초과, 기본값(Fallback) 반환 등 **예외·오류 방어 조건**을 직접 명시했는가? (단순히 "다르게 계산해줘"만 있으면 반드시 false!)
4. hasFormat: 학생이 Python 함수명, 입력 인자 형태, 반환값 자료형 등 **구체적인 코드 입출력 구조**를 명시했는가? (단순히 "구현하고 싶어"만 있으면 반드시 false!)

[대화 스타일 및 답변 작성법]:
- 절대 "프롬프트 점수", "하네스 기준", "4가지 중 ~가 빠졌습니다" 같은 채점관 말투를 쓰지 마세요.
- 4가지 중 하나라도 false라면: 완성 코드를 절대 보여주지 말고, 학생의 아이디어에 공감하며 기술적 원리를 3~4문단으로 상세히 풀어준 뒤, 부족한 부분(예: "그런데 실제 현장에서 데이터에 오타가 있거나 빈 값이 들어오면 어떻게 방어할까요?", "함수 입력과 반환값 형식은 어떻게 잡을까요?")을 자연스러운 개발자 질문으로 유도하세요.
- 4가지가 모두 true라면: introCommentary에 학생의 꼼꼼한 설계를 칭찬하는 도입부(2~3문단)를 쓰고, outroExplanation에 완성 코드의 동작 원리·예외 방어·테스트 예시·VS Code Live Share 적용 팁을 3~4문단으로 풍부하게 작성하세요.

[목표 모듈 코드 (${teamFolder}/${fileName})]:
\`\`\`python
${preassignedCode}
\`\`\`
    `;

    const { result, usedModel } = await generateNaturalResponse({
      contents,
      systemInstruction,
    });

    // 근거 문자열이 비어있지 않고 boolean이 true일 때만 최종 인정
    const checkRole = Boolean(result.hasRole) && String(result.roleEvidence || "").trim().length > 1;
    const checkMetrics = Boolean(result.hasMetrics) && String(result.metricsEvidence || "").trim().length > 1;
    const checkConstraints = Boolean(result.hasConstraints) && String(result.constraintsEvidence || "").trim().length > 1;
    const checkFormat = Boolean(result.hasFormat) && String(result.formatEvidence || "").trim().length > 1;

    const harnessScore = [checkRole, checkMetrics, checkConstraints, checkFormat].filter(Boolean).length;
    const isFinalDelivered = harnessScore === 4;

    const intro = String(result.introCommentary || "").trim();
    const outro = String(result.outroExplanation || "").trim();

    let finalReply = intro;

    if (isFinalDelivered) {
      finalReply = `${intro}\n\n\`\`\`python\n${preassignedCode}\n\`\`\`\n\n${outro}`;
    }

    return NextResponse.json({
      reply: finalReply,
      harnessScore,
      usedModel,
      isFinalDelivered,
    });
  } catch (err: any) {
    console.error("JINMINI API 라우트 에러:", err);
    return NextResponse.json(
      { error: "진미나이 응답 생성 중 오류가 발생했습니다: " + err.message },
      { status: 500 }
    );
  }
}
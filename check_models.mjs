import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const response = await ai.models.list();
    console.log("=== 호출 가능한 모델 목록 ===");
    for await (const model of response) {
      // generateContent 지원 모델만 필터링
      if (model.supportedGenerationMethods?.includes("generateContent")) {
        console.log(`- ${model.name}`);
      }
    }
  } catch (err) {
    console.error("모델 목록 조회 실패:", err);
  }
}

listModels();
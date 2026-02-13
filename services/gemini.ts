import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { MixingInputs, CalculationResults } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.status === 429;
      if (i < maxRetries - 1 && isRateLimit) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const extractGuideData = async (pdfBase64: string): Promise<string> => {
  const prompt = `
    Analyze the attached BHR Group Design Guide. 
    Extract key coefficients for CoV formulas, Momentum Ratio guidelines, and Headloss constants.
    IMPORTANT: Do not use dollar signs ($) for math or units. Use plain text.
  `;
  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }, { text: prompt }],
      },
    }));
    return response.text || "Guide synced.";
  } catch (error) {
    return "Extraction failed.";
  }
};

export const getAIRecommendations = async (inputs: MixingInputs, results: CalculationResults, guideContext?: string) => {
  const prompt = `
    Act as a lead Fluid Dynamics Engineer. Provide a technical audit based on BHR CR 7469.
    
    STRICT FORMATTING RULES:
    - DO NOT use dollar signs ($) for any reason.
    - DO NOT use LaTeX formatting or currency symbols.
    - Use plain text units: m, m/s, kPa, s-1, kg/m3.
    
    SCENARIO:
    - Conduit: ${inputs.conduitType} (${inputs.dimension}m x ${inputs.depth || 'N/A'}m)
    - Flow: ${inputs.flowRate} m3/h
    - Mixer: ${inputs.mixerModel} (${inputs.numElements} elements)
    - Results: CoV ${results.mixerCoV.toFixed(4)}, Headloss ${results.headlossMeters.toFixed(3)} m, MR ${results.momentumRatio.toFixed(3)}.
    
    TASK: Assess Momentum Regime (${results.momentumRegime}), density delta risks, and element efficiency. 
    Format in professional Engineering Markdown (bold and lists).
  `;
  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    }));
    return response.text || "No audit available.";
  } catch (error) {
    return "Audit generation failed.";
  }
};
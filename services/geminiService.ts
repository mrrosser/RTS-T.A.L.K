
import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  // A check to ensure the API key is theoretically available.
  // In a real build process, this would be populated.
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const verifyFact = async (statement: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured. Fact-checking is disabled.";
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Please verify the following statement. Provide a concise confirmation or correction, and if possible, a source. Statement: "${statement}"`,
    });
    return response.text;
  } catch (error) {
    console.error("Error verifying fact with Gemini API:", error);
    if (error instanceof Error) {
        return `An error occurred during fact-checking: ${error.message}`;
    }
    return "An unknown error occurred during fact-checking.";
  }
};

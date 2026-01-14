import { GoogleGenAI, Type } from "@google/genai";
import { Segment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert file to base64
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:audio/mp3;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeAudioAndSegment = async (audioFile: File): Promise<Segment[]> => {
  try {
    const audioBase64 = await fileToGenerativePart(audioFile);

    const prompt = `
      You are an expert video editor and narrator analyzer.
      Task: Analyze the provided audio file.
      1. Transcribe the audio (detect language automatically: Hindi, Hinglish, or English).
      2. Split the narration into logical segments (1-2 sentences per segment) based on pauses, meaning, and topic changes.
      3. For each segment, provide:
         - Accurately synced start_time and end_time (in seconds).
         - The transcribed text.
         - A 'visual_description' describing the ideal image subject, emotion, and action for this segment.
         - An 'emotion' tag (e.g., Dramatic, Happy, Informative, Intense).

      Ensure the segments cover the entire duration of the audio without gaps.
      If the tone is intense, suggest dramatic visuals. If informative, suggest clean visuals.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Good for multimodal audio analysis
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioFile.type,
              data: audioBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start_time: { type: Type.NUMBER, description: "Start time in seconds" },
              end_time: { type: Type.NUMBER, description: "End time in seconds" },
              text: { type: Type.STRING, description: "Transcribed narration text" },
              visual_description: { type: Type.STRING, description: "Description of the visual scene" },
              emotion: { type: Type.STRING, description: "Detected emotion" }
            },
            required: ["start_time", "end_time", "text", "visual_description", "emotion"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || "[]");

    // Map to our internal Segment type
    return rawData.map((item: any, index: number) => ({
      id: `seg-${index}-${Date.now()}`,
      startTime: item.start_time,
      endTime: item.end_time,
      text: item.text,
      visualPrompt: item.visual_description,
      emotion: item.emotion,
      assignedImageId: undefined
    }));

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze audio. Please ensure the file is supported and under the size limit.");
  }
};

export const matchImagesToSegments = async (segments: Segment[], images: { id: string, description?: string }[]): Promise<Segment[]> => {
   // In a full production app, we would use embeddings.
   // Here, we will do a simulated "smart match" by just distributing them or
   // asking Gemini to map IDs if we had image descriptions.
   // For this demo, we will rely on the UI to let the user drag/drop,
   // BUT we will pre-fill sequentially to ensure "no gaps" logic from instructions.

   const filledSegments = [...segments];
   if (images.length === 0) return filledSegments;

   // Simple logic: distribute images across segments to ensure visual continuity
   // Changing image only when topic changes (simulated by segment breaks)
   filledSegments.forEach((seg, index) => {
      const imageIndex = index % images.length;
      seg.assignedImageId = images[imageIndex].id;
   });

   return filledSegments;
};

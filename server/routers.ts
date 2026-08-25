import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";

type EnvironmentResult = {
  summary: string;
  caution?: string;
  objects: string[];
};

function safeEnvironmentResult(content: string): EnvironmentResult {
  try {
    const value = JSON.parse(content) as Partial<EnvironmentResult>;
    const summary = typeof value.summary === "string" ? value.summary.trim() : "無法可靠描述這張畫面。";
    const caution = typeof value.caution === "string" && value.caution.trim() ? value.caution.trim() : undefined;
    const objects = Array.isArray(value.objects) ? value.objects.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
    return { summary, caution, objects };
  } catch {
    return { summary: "影像分析完成，但回應格式無法讀取。請重新拍攝並自行確認周遭狀況。", objects: [] };
  }
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  vision: router({
    analyze: publicProcedure
      .input(z.object({ imageData: z.string().regex(/^data:image\/(jpeg|png);base64,/).max(6_000_000) }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            maxCompletionTokens: 700,
            reasoning: { effort: "minimal" },
            messages: [
              {
                role: "system",
                content: "你是視障者的環境描述輔助。請使用繁體中文，以 2 到 3 句描述可直接從影像看見的主要物件、顯著文字與相對位置。不要辨識人物身分、不要推測深度/距離、不要說道路一定安全、不要下達導航命令。若影像可見階梯、車輛、門口、坑洞、施工區或其他可能需要留意的物件，請謹慎地在 caution 欄位說明『可能』需要確認。僅輸出 JSON 物件：{summary:string,caution?:string,objects:string[]}。",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "請描述這一張即時相機畫面。" },
                  { type: "image_url", image_url: { url: input.imageData, detail: "low" } },
                ],
              },
            ],
          });
          const content = response.choices?.[0]?.message?.content;
          if (typeof content !== "string" || !content.trim()) {
            throw new Error("AI 服務未回傳可用的影像描述，請重新拍攝後再試一次。");
          }
          return safeEnvironmentResult(content);
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? `影像辨識暫時無法完成：${error.message}` : "影像辨識暫時無法完成。" });
        }
      }),
  }),
  voice: router({
    transcribe: publicProcedure
      .input(z.object({
        audioBase64: z.string().min(20).max(22_000_000),
        mimeType: z.enum(["audio/mp4", "audio/m4a", "audio/webm", "audio/mpeg", "audio/wav"]),
      }))
      .mutation(async ({ input }) => {
        const response = await transcribeAudio({
          audioBase64: input.audioBase64,
          mimeType: input.mimeType,
          language: "zh",
          prompt: "請以繁體中文忠實轉錄使用者的語音指令或記事內容。",
        });
        if ("error" in response) {
          throw new TRPCError({ code: "BAD_REQUEST", message: response.error });
        }
        return { text: response.text.trim(), language: response.language };
      }),
  }),
});

export type AppRouter = typeof appRouter;

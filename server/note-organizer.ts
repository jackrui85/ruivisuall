import { invokeLLM } from "./_core/llm";

export const noteCategories = ["待辦", "提醒", "行程", "資訊", "想法", "其他"] as const;
export type NoteCategory = (typeof noteCategories)[number];

export type NoteOrganization = {
  summary: string;
  category: NoteCategory;
  keywords: string[];
};

const fallbackOrganization = (text: string): NoteOrganization => ({
  summary: text.trim().slice(0, 80) || "未能產生摘要",
  category: "其他",
  keywords: [],
});

export function parseNoteOrganization(content: string, sourceText: string): NoteOrganization {
  try {
    const json = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const value = JSON.parse(json) as Partial<NoteOrganization>;
    const summary = typeof value.summary === "string" && value.summary.trim()
      ? value.summary.trim().slice(0, 120)
      : fallbackOrganization(sourceText).summary;
    const category = typeof value.category === "string" && noteCategories.includes(value.category as NoteCategory)
      ? value.category as NoteCategory
      : "其他";
    const keywords = Array.isArray(value.keywords)
      ? value.keywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 4)
      : [];
    return { summary, category, keywords };
  } catch {
    return fallbackOrganization(sourceText);
  }
}

export async function organizeNote(text: string): Promise<NoteOrganization> {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxCompletionTokens: 400,
    reasoning: { effort: "minimal" },
    messages: [
      {
        role: "system",
        content: "你協助視障者整理個人語音記事。僅根據提供文字，以繁體中文輸出單一 JSON 物件，格式為 {summary:string,category:string,keywords:string[]}。summary 必須是一句不超過 35 字的中性摘要；category 只能是 待辦、提醒、行程、資訊、想法、其他 之一；keywords 最多 4 個。不得猜測、不得加入原文未提及的個資、日期或行動建議。",
      },
      { role: "user", content: `請整理這則記事：\n${text}` },
    ],
  });
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI 服務未回傳可用的記事整理結果。");
  }
  return parseNoteOrganization(content, text);
}

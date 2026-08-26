import { describe, expect, it, vi } from "vitest";

vi.mock("expo-speech", () => ({
  speak: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import { buildSavedNotesReadout, createBrowserUrl, filterNotesByCriteria, parseNoteSearchCommand, parseVoiceCommand } from "../lib/sightguide";

describe("視界助行語音指令", () => {
  it("辨識常見的環境、位置、時間與記事指令", () => {
    expect(parseVoiceCommand("請幫我辨識環境")).toEqual({ type: "recognize" });
    expect(parseVoiceCommand("我在哪裡")).toEqual({ type: "location" });
    expect(parseVoiceCommand("現在幾點")).toEqual({ type: "time" });
    expect(parseVoiceCommand("我要建立記事")).toEqual({ type: "note" });
  });

  it("把瀏覽器語音轉為含搜尋字詞的命令", () => {
    expect(parseVoiceCommand("搜尋公車即時動態")).toEqual({ type: "browse", query: "公車即時動態" });
    expect(parseVoiceCommand("開啟台灣銀行")).toEqual({ type: "browse", query: "台灣銀行" });
  });
});

describe("安全網址建立", () => {
  it("保留 http 與 https 網址", () => {
    expect(createBrowserUrl("https://www.gov.tw")).toBe("https://www.gov.tw/");
    expect(createBrowserUrl("http://example.com/info")).toBe("http://example.com/info");
  });

  it("把一般文字轉成經過編碼的搜尋網址", () => {
    expect(createBrowserUrl("公車 即時 動態")).toBe("https://www.google.com/search?q=%E5%85%AC%E8%BB%8A%20%E5%8D%B3%E6%99%82%20%E5%8B%95%E6%85%8B");
  });
});

describe("已儲存記事朗讀內容", () => {
  it("依分類、摘要與內容建立可朗讀的文字", () => {
    const result = buildSavedNotesReadout([
      { id: "1", text: "明天早上十點打電話給醫院", createdAt: "2026-08-26T10:00:00.000Z", category: "提醒", summary: "明早十點致電醫院" },
    ]);
    expect(result).toContain("共有 1 則已儲存記事");
    expect(result).toContain("分類：提醒");
    expect(result).toContain("摘要：明早十點致電醫院");
  });

  it("沒有記事時會提供明確語音回饋", () => {
    expect(buildSavedNotesReadout([])).toBe("目前沒有已儲存的文字記事。");
  });
});

describe("語音搜尋與分類篩選", () => {
  const notes = [
    { id: "1", text: "明天早上致電醫院", createdAt: "2026-08-26T10:00:00.000Z", category: "提醒" as const, summary: "致電醫院", keywords: ["醫院"] },
    { id: "2", text: "採買牛奶與麵包", createdAt: "2026-08-26T11:00:00.000Z", category: "待辦" as const, summary: "採買清單", keywords: ["牛奶"] },
  ];

  it("從語音命令擷取分類與關鍵字", () => {
    expect(parseNoteSearchCommand("搜尋提醒類別的記事")).toEqual({ category: "提醒", keyword: undefined });
    expect(parseNoteSearchCommand("搜尋關鍵字醫院")).toEqual({ category: undefined, keyword: "醫院" });
  });

  it("可依分類或關鍵字篩選記事", () => {
    expect(filterNotesByCriteria(notes, { category: "待辦" })).toHaveLength(1);
    expect(filterNotesByCriteria(notes, { keyword: "醫院" })[0]?.id).toBe("1");
  });
});

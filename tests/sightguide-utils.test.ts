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

import { createBrowserUrl, parseVoiceCommand } from "../lib/sightguide";

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

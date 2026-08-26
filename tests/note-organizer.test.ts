import { describe, expect, it } from "vitest";

import { parseNoteOrganization } from "../server/note-organizer";

describe("記事 AI 整理結果", () => {
  it("保留允許的分類與精簡關鍵字", () => {
    expect(parseNoteOrganization('{"summary":"明早十點致電醫院","category":"提醒","keywords":["醫院","電話"]}', "明天早上十點打電話給醫院")).toEqual({
      summary: "明早十點致電醫院",
      category: "提醒",
      keywords: ["醫院", "電話"],
    });
  });

  it("不合法回應會回退到安全的未分類摘要", () => {
    expect(parseNoteOrganization("不是 JSON", "買牛奶")).toEqual({ summary: "買牛奶", category: "其他", keywords: [] });
  });
});

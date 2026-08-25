import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://forge.example.test",
    forgeApiKey: "test-key",
  },
}));

import { transcribeAudio } from "../server/_core/voiceTranscription";

describe("語音轉錄資料路徑", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("可直接接受 Android Base64 錄音，而不依賴 data URL 重新下載", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ task: "transcribe", language: "zh", duration: 1, text: "建立記事", segments: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await transcribeAudio({
      audioBase64: Buffer.from("sample-audio-bytes").toString("base64"),
      mimeType: "audio/mp4",
      language: "zh",
    });

    expect("error" in response).toBe(false);
    if ("error" in response) throw new Error(response.error);
    expect(response.text).toBe("建立記事");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/audio/transcriptions");
  });
});

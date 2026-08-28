import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { noteCategories, type NoteCategory } from "../shared/note-categories";

export { noteCategories, type NoteCategory } from "../shared/note-categories";

export type SightGuideNote = {
  id: string;
  text: string;
  createdAt: string;
  audioUri?: string;
  summary?: string;
  category?: NoteCategory;
  keywords?: string[];
};

export type AccessibilityPreferences = {
  speechRate: number;
  detailLevel: "brief" | "standard";
  autoReadResults: boolean;
};

export type VoiceCommand =
  | { type: "recognize" }
  | { type: "location" }
  | { type: "time" }
  | { type: "note" }
  | { type: "browse"; query?: string }
  | { type: "unknown"; raw: string };

const NOTES_KEY = "sightguide.notes.v1";
const SETTINGS_KEY = "sightguide.preferences.v1";

export const defaultPreferences: AccessibilityPreferences = {
  speechRate: 0.9,
  detailLevel: "standard",
  autoReadResults: true,
};

export async function getPreferences(): Promise<AccessibilityPreferences> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultPreferences;
    return { ...defaultPreferences, ...(JSON.parse(raw) as Partial<AccessibilityPreferences>) };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: AccessibilityPreferences) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
}

export async function speakText(text: string, rate?: number) {
  const preferences = await getPreferences();
  await Speech.stop();
  Speech.speak(text, {
    language: "zh-TW",
    rate: rate ?? preferences.speechRate,
    pitch: 1,
  });
}

export async function stopSpeaking() {
  await Speech.stop();
}

export async function getNotes(): Promise<SightGuideNote[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    return raw ? (JSON.parse(raw) as SightGuideNote[]) : [];
  } catch {
    return [];
  }
}

export async function saveNotes(notes: SightGuideNote[]) {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function buildEnvironmentNoteText(summary: string, caution?: string) {
  const safeSummary = summary.trim();
  const safeCaution = caution?.trim();
  return `環境辨識結果：${safeCaution ? `請注意，${safeCaution}。` : ""}${safeSummary}`;
}

export type NoteSearchCriteria = {
  category?: NoteCategory;
  keyword?: string;
};

export function parseNoteSearchCommand(raw: string): NoteSearchCriteria {
  const text = raw.trim().replace(/\s+/g, "");
  const category = noteCategories.find((item) => text.includes(item));
  const keyword = text
    .replace(/^(請幫我|幫我|我要|請)?(搜尋|查找|尋找|找|查詢|篩選|顯示)/, "")
    .replace(/(所有|分類|類別|關鍵字|標籤|的|記事|筆記|內容)/g, "")
    .replace(category ?? "", "")
    .trim();
  return { category, keyword: keyword || undefined };
}

export function filterNotesByCriteria(notes: SightGuideNote[], criteria: NoteSearchCriteria) {
  const keyword = criteria.keyword?.toLocaleLowerCase("zh-TW");
  return notes.filter((note) => {
    const categoryMatches = !criteria.category || note.category === criteria.category;
    const searchable = [note.text, note.summary, ...(note.keywords ?? [])].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW");
    return categoryMatches && (!keyword || searchable.includes(keyword));
  });
}

export function buildSavedNotesReadout(notes: SightGuideNote[]) {
  if (notes.length === 0) return "目前沒有已儲存的文字記事。";
  const visibleNotes = notes.slice(0, 10);
  const content = visibleNotes.map((note, index) => {
    const category = note.category || "未分類";
    const summary = note.summary ? `摘要：${note.summary}。` : "";
    return `第 ${index + 1} 則，分類：${category}。${summary}內容：${note.text}`;
  }).join("。 ");
  const remainder = notes.length > visibleNotes.length ? `尚有 ${notes.length - visibleNotes.length} 則未朗讀。` : "";
  return `共有 ${notes.length} 則已儲存記事。${content}。${remainder}`;
}

export function getEnvironmentRecognitionErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  const normalized = rawMessage.toLowerCase();

  if (/failed to fetch|network request failed|networkerror|load failed|fetch failed/.test(normalized)) {
    return "無法連線到環境辨識服務。請確認手機網路，重新掃描最新測試連線後再試一次。";
  }
  if (/502|503|504|gateway|port is not open|沒有回應/.test(normalized)) {
    return "環境辨識服務目前沒有回應。請重新啟動開發服務或重新掃描最新測試連線後再試一次。";
  }
  if (/timeout|timed out|逾時/.test(normalized)) {
    return "環境辨識等待逾時。請將鏡頭對準主要目標，確認網路後再試一次。";
  }
  if (rawMessage.includes("影像辨識暫時無法完成")) return rawMessage;
  return rawMessage || "影像辨識暫時無法完成，請重新拍攝後再試一次。";
}

export function formatReadableTime(date = new Date()) {
  const dateText = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
  const timeText = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `現在是${dateText}，${timeText}`;
}

export function parseVoiceCommand(raw: string): VoiceCommand {
  const normalized = raw.trim().replace(/\s+/g, "").toLowerCase();
  if (!normalized) return { type: "unknown", raw };
  if (/(辨識|看一下|看前方|環境|相機)/.test(normalized)) return { type: "recognize" };
  if (/(在哪裡|位置|定位|方位)/.test(normalized)) return { type: "location" };
  if (/(幾點|時間|日期)/.test(normalized)) return { type: "time" };
  if (/(記事|筆記|記下|備忘)/.test(normalized)) return { type: "note" };
  if (/(瀏覽器|開啟|搜尋|查詢|上網)/.test(normalized)) {
    const query = raw
      .replace(/(請幫我|幫我|我要|請|用)?(開啟|搜尋|查詢|瀏覽|上網|瀏覽器)/g, "")
      .trim();
    return { type: "browse", query: query || undefined };
  }
  return { type: "unknown", raw };
}

export function createBrowserUrl(raw: string) {
  const text = raw.trim();
  if (!text) return "https://www.google.com";
  const hasProtocol = /^https?:\/\//i.test(text);
  const looksLikeDomain = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(text);
  if (hasProtocol || looksLikeDomain) {
    try {
      const url = new URL(hasProtocol ? text : `https://${text}`);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {
      // The text is a malformed domain, handled as a search query below.
    }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

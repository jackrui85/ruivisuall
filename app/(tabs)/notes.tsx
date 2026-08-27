import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { buildSavedNotesReadout, filterNotesByCriteria, getNotes, noteCategories, parseNoteSearchCommand, saveNotes, SightGuideNote, speakText, type NoteCategory } from "@/lib/sightguide";
import { trpc } from "@/lib/trpc";

export default function NotesScreen() {
  const [notes, setNotes] = useState<SightGuideNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | "全部">("全部");
  const [searchKeyword, setSearchKeyword] = useState<string | undefined>();
  const [searchStatus, setSearchStatus] = useState("尚未篩選記事。");
  const players = useRef(new Set<ReturnType<typeof createAudioPlayer>>());
  const organizeNote = trpc.notes.organize.useMutation();

  useEffect(() => {
    const activePlayers = players.current;
    void getNotes().then((saved) => { setNotes(saved); setLoading(false); });
    return () => activePlayers.forEach((player) => player.remove());
  }, []);

  const addTranscribedNote = useCallback(async (text: string, audioUri?: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      await speakText("沒有辨識到記事內容，請再錄一次。");
      return;
    }
    const note: SightGuideNote = { id: `${Date.now()}`, text: trimmed, createdAt: new Date().toISOString(), audioUri };
    setNotes((current) => {
      const next = [note, ...current];
      void saveNotes(next);
      return next;
    });
    try {
      const organization = await organizeNote.mutateAsync({ text: trimmed });
      setNotes((current) => {
        const next = current.map((item) => item.id === note.id ? { ...item, ...organization } : item);
        void saveNotes(next);
        return next;
      });
      await speakText(`已成功儲存記事。分類為${organization.category}。摘要：${organization.summary}`);
    } catch {
      await speakText("已成功儲存記事，但暫時無法自動分類。您仍可使用文字內容搜尋此記事。");
    }
  }, [organizeNote]);
  const voice = useVoiceCapture({ persistAudio: true, onTranscript: addTranscribedNote });

  const filteredNotes = filterNotesByCriteria(notes, { category: selectedCategory === "全部" ? undefined : selectedCategory, keyword: searchKeyword });

  const applySearch = useCallback(async (raw: string) => {
    const criteria = parseNoteSearchCommand(raw);
    setSelectedCategory(criteria.category ?? "全部");
    setSearchKeyword(criteria.keyword);
    const resultCount = filterNotesByCriteria(notes, criteria).length;
    const description = `${criteria.category ? `分類${criteria.category}` : "全部分類"}${criteria.keyword ? `，關鍵字${criteria.keyword}` : ""}`;
    const message = `已套用${description}搜尋，找到${resultCount}則記事。`;
    setSearchStatus(message);
    await speakText(message);
  }, [notes]);
  const searchVoice = useVoiceCapture({ onTranscript: applySearch });

  const selectCategory = async (category: NoteCategory | "全部") => {
    setSelectedCategory(category);
    setSearchKeyword(undefined);
    const count = category === "全部" ? notes.length : notes.filter((note) => note.category === category).length;
    const message = category === "全部" ? `已選擇全部分類，共${count}則記事。` : `已選擇${category}分類，共${count}則記事。`;
    setSearchStatus(message);
    await speakText(message);
  };

  const readSavedNotes = async () => {
    await speakText(buildSavedNotesReadout(notes));
  };

  const deleteNote = async (note: SightGuideNote) => {
    const next = notes.filter((item) => item.id !== note.id);
    setNotes(next);
    await saveNotes(next);
    if (note.audioUri) {
      try { await FileSystem.deleteAsync(note.audioUri, { idempotent: true }); } catch { /* The textual note remains deleted even if the cached audio is unavailable. */ }
    }
    await speakText("已刪除記事。");
  };

  const playAudio = (note: SightGuideNote) => {
    if (!note.audioUri) return;
    try {
      const player = createAudioPlayer(note.audioUri);
      players.current.add(player);
      player.play();
      setTimeout(() => { player.remove(); players.current.delete(player); }, 90_000);
    } catch {
      void speakText("無法播放這段錄音，但文字記事仍可報讀。");
    }
  };

  return (
    <ScreenContainer className="px-5">
      <View style={styles.page}>
        <Text accessibilityRole="header" style={styles.title}>語音記事</Text>
        <Text style={styles.subtitle}>錄下的聲音會轉成文字並保留在這部手機；若成功儲存，也可播放原始錄音。</Text>
        <View accessible accessibilityLabel={`錄音狀態：${voice.error || (voice.isRecording ? "正在錄音" : "尚未錄音")}`} style={styles.statusCard}>
          <Text style={styles.statusText}>{voice.error || (voice.isRecording ? "正在錄音。完成後按停止並儲存。" : "按下開始錄音，說完後再按一次。")}</Text>
          {(voice.isRecording || searchVoice?.isRecording) ? <Text accessibilityLiveRegion="polite" style={styles.durationText}>錄音時間：{voice.isRecording ? voice.recordingDurationLabel : searchVoice.recordingDurationLabel}。每 30 秒會自動語音提示一次。</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={voice.isRecording ? "停止錄音並儲存記事" : "開始錄製語音記事"} onPress={voice.isRecording ? voice.stop : voice.start} disabled={(voice.isBusy || searchVoice.isBusy) && !voice.isRecording} style={({ pressed }) => [styles.recordButton, (pressed || voice.isBusy) && styles.pressed]}>
          {voice.isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.recordText}>{voice.isRecording ? "停止錄音並儲存" : "開始錄音"}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={searchVoice.isRecording ? "停止語音搜尋記事" : "開始語音搜尋記事"} accessibilityHint="可說搜尋提醒，或搜尋關鍵字醫院" onPress={searchVoice.isRecording ? searchVoice.stop : searchVoice.start} disabled={(voice.isBusy || searchVoice.isBusy) && !searchVoice.isRecording} style={({ pressed }) => [styles.searchButton, (pressed || searchVoice.isBusy) && styles.pressed]}>
          {searchVoice.isProcessing ? <ActivityIndicator color="#153D73" /> : <Text style={styles.searchText}>{searchVoice.isRecording ? `停止語音搜尋（${searchVoice.recordingDurationLabel}）` : "語音搜尋記事"}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="朗讀所有已儲存文字記事" accessibilityHint="依儲存順序朗讀最近十則記事的分類、摘要與內容" onPress={() => void readSavedNotes()} disabled={notes.length === 0} style={({ pressed }) => [styles.readAllButton, (pressed || notes.length === 0) && styles.pressed]}>
          <Text style={styles.readAllText}>朗讀已儲存記事</Text>
        </Pressable>
        <View accessible accessibilityLabel={`篩選狀態：${searchStatus}`} style={styles.filterPanel}>
          <Text style={styles.filterTitle}>分類篩選</Text>
          <View style={styles.filterButtons}>
            {(["全部", ...noteCategories] as const).map((category) => {
              const selected = selectedCategory === category;
              return <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`篩選${category}分類，${selected ? "目前已選取" : "未選取"}`} onPress={() => void selectCategory(category)} style={({ pressed }) => [styles.filterButton, selected && styles.filterButtonSelected, pressed && styles.pressed]}><Text style={[styles.filterButtonText, selected && styles.filterButtonTextSelected]}>{category}</Text></Pressable>;
            })}
          </View>
          <Text style={styles.filterStatus}>{searchStatus}</Text>
        </View>
        {loading ? <ActivityIndicator color="#153D73" style={styles.loader} /> : (
          <FlatList
            data={filteredNotes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>{notes.length === 0 ? "尚未有記事。請使用開始錄音建立第一則語音記事。" : "沒有符合目前搜尋或分類的記事。"}</Text>}
            renderItem={({ item }) => (
              <View accessible accessibilityLabel={`記事，分類：${item.category || "未分類"}。${item.summary ? `摘要：${item.summary}。` : ""}內容：${item.text}`} style={styles.noteCard}>
                <Text style={styles.noteDate}>{new Intl.DateTimeFormat("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</Text>
                <View style={styles.noteMeta}><Text style={styles.category}>{item.category || "未分類"}</Text>{item.summary ? <Text style={styles.summary}>{item.summary}</Text> : organizeNote.isPending ? <Text style={styles.organizing}>正在整理摘要…</Text> : null}</View>
                <Text style={styles.noteText}>{item.text}</Text>
                <View style={styles.noteActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="報讀此記事" onPress={() => void speakText(item.text)} style={styles.smallButton}><Text style={styles.smallButtonText}>報讀</Text></Pressable>
                  {item.audioUri ? <Pressable accessibilityRole="button" accessibilityLabel="播放原始錄音" onPress={() => playAudio(item)} style={styles.smallButton}><Text style={styles.smallButtonText}>播放</Text></Pressable> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel="刪除此記事" onPress={() => void deleteNote(item)} style={styles.deleteButton}><Text style={styles.deleteText}>刪除</Text></Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 22 },
  title: { color: "#0D1B2A", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#475569", fontSize: 16, lineHeight: 24, marginTop: 6 },
  statusCard: { padding: 14, borderRadius: 16, backgroundColor: "#EEF6FF", marginTop: 16 },
  statusText: { color: "#1E3A5F", fontSize: 16, lineHeight: 24, fontWeight: "600" },
  durationText: { color: "#0F5D59", fontSize: 17, lineHeight: 24, fontWeight: "800", marginTop: 8 },
  recordButton: { minHeight: 62, borderRadius: 18, backgroundColor: "#00A6A6", alignItems: "center", justifyContent: "center", marginTop: 12 },
  recordText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  searchButton: { minHeight: 54, borderRadius: 16, backgroundColor: "#DDF7F4", borderWidth: 1, borderColor: "#0F766E", alignItems: "center", justifyContent: "center", marginTop: 10 },
  searchText: { color: "#0F5D59", fontSize: 18, fontWeight: "800" },
  readAllButton: { minHeight: 54, borderRadius: 16, backgroundColor: "#153D73", alignItems: "center", justifyContent: "center", marginTop: 10 },
  readAllText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  filterPanel: { backgroundColor: "#F1F7FC", borderRadius: 16, padding: 14, marginTop: 12, gap: 10 },
  filterTitle: { color: "#153D73", fontSize: 18, fontWeight: "800" },
  filterButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#BED2E2", justifyContent: "center", alignItems: "center" },
  filterButtonSelected: { backgroundColor: "#153D73", borderColor: "#153D73" },
  filterButtonText: { color: "#153D73", fontSize: 16, fontWeight: "800" },
  filterButtonTextSelected: { color: "#FFFFFF" },
  filterStatus: { color: "#475569", fontSize: 15, lineHeight: 22 },
  loader: { marginTop: 28 },
  list: { paddingTop: 16, paddingBottom: 18, gap: 12 },
  empty: { color: "#475569", textAlign: "center", fontSize: 17, lineHeight: 26, paddingTop: 26 },
  noteCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E0EA", borderRadius: 18, padding: 16, gap: 8 },
  noteDate: { color: "#64748B", fontWeight: "700", fontSize: 14 },
  noteMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  category: { color: "#0F766E", fontWeight: "800", fontSize: 15, backgroundColor: "#DDF7F4", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  summary: { color: "#334155", flexShrink: 1, fontSize: 16, lineHeight: 23 },
  organizing: { color: "#64748B", fontSize: 15, fontStyle: "italic" },
  noteText: { color: "#0D1B2A", fontSize: 18, lineHeight: 27, fontWeight: "600" },
  noteActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  smallButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#DDEDF5", justifyContent: "center", alignItems: "center" },
  smallButtonText: { color: "#153D73", fontWeight: "800", fontSize: 16 },
  deleteButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#FCE8E8", justifyContent: "center", alignItems: "center" },
  deleteText: { color: "#A61B1B", fontWeight: "800", fontSize: 16 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});

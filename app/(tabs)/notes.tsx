import { File } from "expo-file-system";
import { createAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { getNotes, saveNotes, SightGuideNote, speakText } from "@/lib/sightguide";

export default function NotesScreen() {
  const [notes, setNotes] = useState<SightGuideNote[]>([]);
  const [loading, setLoading] = useState(true);
  const players = useRef(new Set<ReturnType<typeof createAudioPlayer>>());

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
    const next = [note, ...notes];
    setNotes(next);
    await saveNotes(next);
    await speakText(`已儲存記事：${trimmed}`);
  }, [notes]);
  const voice = useVoiceCapture({ persistAudio: true, onTranscript: addTranscribedNote });

  const deleteNote = async (note: SightGuideNote) => {
    const next = notes.filter((item) => item.id !== note.id);
    setNotes(next);
    await saveNotes(next);
    if (note.audioUri) {
      try { new File(note.audioUri).delete(); } catch { /* The textual note remains deleted even if the cached audio is unavailable. */ }
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
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={voice.isRecording ? "停止錄音並儲存記事" : "開始錄製語音記事"} onPress={voice.isRecording ? voice.stop : voice.start} disabled={voice.isProcessing} style={({ pressed }) => [styles.recordButton, (pressed || voice.isProcessing) && styles.pressed]}>
          {voice.isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.recordText}>{voice.isRecording ? "停止錄音並儲存" : "開始錄音"}</Text>}
        </Pressable>
        {loading ? <ActivityIndicator color="#153D73" style={styles.loader} /> : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>尚未有記事。請使用開始錄音建立第一則語音記事。</Text>}
            renderItem={({ item }) => (
              <View accessible accessibilityLabel={`記事：${item.text}`} style={styles.noteCard}>
                <Text style={styles.noteDate}>{new Intl.DateTimeFormat("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</Text>
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
  recordButton: { minHeight: 62, borderRadius: 18, backgroundColor: "#00A6A6", alignItems: "center", justifyContent: "center", marginTop: 12 },
  recordText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  loader: { marginTop: 28 },
  list: { paddingTop: 16, paddingBottom: 18, gap: 12 },
  empty: { color: "#475569", textAlign: "center", fontSize: 17, lineHeight: 26, paddingTop: 26 },
  noteCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E0EA", borderRadius: 18, padding: 16, gap: 8 },
  noteDate: { color: "#64748B", fontWeight: "700", fontSize: 14 },
  noteText: { color: "#0D1B2A", fontSize: 18, lineHeight: 27, fontWeight: "600" },
  noteActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  smallButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#DDEDF5", justifyContent: "center", alignItems: "center" },
  smallButtonText: { color: "#153D73", fontWeight: "800", fontSize: 16 },
  deleteButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#FCE8E8", justifyContent: "center", alignItems: "center" },
  deleteText: { color: "#A61B1B", fontWeight: "800", fontSize: 16 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});

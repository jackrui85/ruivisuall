import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { formatReadableTime, parseVoiceCommand, speakText, stopSpeaking } from "@/lib/sightguide";

type ActionProps = { label: string; detail: string; onPress: () => void; tone?: "primary" | "teal" | "light" };

function ActionCard({ label, detail, onPress, tone = "light" }: ActionProps) {
  const toneStyle = tone === "primary" ? styles.actionPrimary : tone === "teal" ? styles.actionTeal : undefined;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} onPress={onPress} style={({ pressed }) => [styles.action, toneStyle, pressed && styles.pressed]}>
      <Text style={[styles.actionLabel, tone !== "light" && styles.actionLabelInverse]}>{label}</Text>
      <Text style={[styles.actionDetail, tone !== "light" && styles.actionDetailInverse]}>{detail}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [status, setStatus] = useState("就緒。你可以按住語音指令，或直接選擇下方功能。");
  const onVoiceCommand = useCallback(async (text: string) => {
    const command = parseVoiceCommand(text);
    if (command.type === "recognize") return router.push("/camera" as never);
    if (command.type === "location") return router.push("/location" as never);
    if (command.type === "note") return router.push("/notes" as never);
    if (command.type === "browse") return router.push({ pathname: "/browser", params: { initialQuery: command.query ?? "" } } as never);
    if (command.type === "time") {
      const reply = formatReadableTime();
      setStatus(reply);
      await speakText(reply);
      return;
    }
    const reply = `我聽到：${text}。你可以說辨識環境、我在哪裡、現在時間、建立記事或搜尋網站。`;
    setStatus(reply);
    await speakText(reply);
  }, []);
  const voice = useVoiceCapture({ onTranscript: onVoiceCommand });

  return (
    <ScreenContainer className="px-5">
      <ScrollView contentContainerStyle={styles.page}>
        <View accessible accessibilityLabel="視界助行 AI 首頁" style={styles.hero}>
          <Text accessibilityRole="header" style={styles.title}>視界助行 AI</Text>
          <Text style={styles.subtitle}>以語音主導操作，協助描述畫面、報讀時間與位置、建立記事及開啟網頁。</Text>
        </View>
        <View accessible accessibilityLabel={`語音狀態：${voice.error || status}`} style={styles.status}>
          <Text style={styles.statusLabel}>語音狀態</Text>
          <Text style={styles.statusText}>{voice.error || status}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={voice.isRecording ? "停止語音指令並開始理解" : "開始語音指令"} accessibilityHint="可說辨識環境、我在哪裡、現在時間、建立記事或搜尋網站" onPress={voice.isRecording ? voice.stop : voice.start} disabled={voice.isBusy && !voice.isRecording} style={({ pressed }) => [styles.voiceControl, (pressed || voice.isBusy) && styles.pressed]}>
          {voice.isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.voiceControlText}>{voice.isRecording ? "停止錄音並理解" : "開始語音指令"}</Text>}
        </Pressable>
        <View style={styles.actions}>
          <ActionCard tone="primary" label="辨識環境" detail="以相機拍攝目前畫面，取得簡短的語音描述。" onPress={() => router.push("/camera" as never)} />
          <ActionCard tone="teal" label="位置與時間" detail="取得前景定位資訊，或報讀現在時間。" onPress={() => router.push("/location" as never)} />
          <ActionCard label="語音記事" detail="錄下想記住的內容，轉成文字並保存於這部手機。" onPress={() => router.push("/notes" as never)} />
          <ActionCard label="語音瀏覽器" detail="說出搜尋內容或網站，由系統瀏覽器開啟。" onPress={() => router.push("/browser" as never)} />
        </View>
        <View accessible accessibilityLabel="安全提醒：本應用僅提供輔助資訊，不能取代白手杖、導盲犬或道路安全判斷" style={styles.safety}>
          <Text style={styles.safetyTitle}>安全提醒</Text>
          <Text style={styles.safetyText}>影像與位置結果可能不準確或延遲，請持續使用可靠的定向行動方式確認周遭狀況。</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="停止所有語音" onPress={() => void stopSpeaking()} style={styles.stopButton}><Text style={styles.stopText}>停止所有語音</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: 22, gap: 14 },
  hero: { gap: 8 },
  title: { color: "#0D1B2A", fontSize: 32, fontWeight: "800", lineHeight: 40 },
  subtitle: { color: "#475569", fontSize: 17, lineHeight: 26 },
  status: { borderRadius: 18, backgroundColor: "#EEF6FF", padding: 16, gap: 6, borderWidth: 1, borderColor: "#C7DDF1" },
  statusLabel: { color: "#0F766E", fontWeight: "800", fontSize: 15 },
  statusText: { color: "#1E3A5F", fontSize: 17, fontWeight: "600", lineHeight: 25 },
  voiceControl: { minHeight: 68, borderRadius: 18, backgroundColor: "#153D73", justifyContent: "center", alignItems: "center" },
  voiceControlText: { color: "#FFFFFF", fontSize: 21, fontWeight: "800" },
  actions: { gap: 10 },
  action: { minHeight: 94, borderRadius: 18, padding: 18, justifyContent: "center", gap: 5, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#FFFFFF" },
  actionPrimary: { backgroundColor: "#153D73", borderColor: "#153D73" },
  actionTeal: { backgroundColor: "#007F80", borderColor: "#007F80" },
  actionLight: {},
  actionLabel: { color: "#0D1B2A", fontSize: 21, fontWeight: "800" },
  actionDetail: { color: "#475569", fontSize: 16, lineHeight: 23 },
  actionLabelInverse: { color: "#FFFFFF" },
  actionDetailInverse: { color: "#E2F5F5" },
  safety: { borderRadius: 18, padding: 16, backgroundColor: "#FFF2E4", gap: 6, borderWidth: 1, borderColor: "#F0C38C" },
  safetyTitle: { color: "#884600", fontSize: 18, fontWeight: "800" },
  safetyText: { color: "#5D3700", fontSize: 16, lineHeight: 24 },
  stopButton: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  stopText: { color: "#A61B1B", fontSize: 17, fontWeight: "800" },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});

import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { createBrowserUrl, parseVoiceCommand, speakText, stopSpeaking } from "@/lib/sightguide";

export default function BrowserScreen() {
  const params = useLocalSearchParams<{ initialQuery?: string }>();
  const [query, setQuery] = useState(params.initialQuery ?? "");
  const [status, setStatus] = useState("說出想搜尋的內容，或輸入網站網址。");

  const openBrowser = useCallback(async (rawQuery = query) => {
    const target = createBrowserUrl(rawQuery);
    try {
      setStatus(`準備開啟：${target}`);
      await speakText("正在開啟系統瀏覽器。網站內的操作需要由你自行確認。");
      await WebBrowser.openBrowserAsync(target, { toolbarColor: "#153D73", controlsColor: "#FFFFFF", showTitle: true });
    } catch {
      const message = "無法開啟系統瀏覽器，請確認裝置是否有可用的瀏覽器。";
      setStatus(message);
      await speakText(message);
    }
  }, [query]);

  const handleTranscript = useCallback(async (text: string) => {
    const command = parseVoiceCommand(text);
    const nextQuery = command.type === "browse" ? command.query || text : text;
    setQuery(nextQuery);
    const message = `已聽到：${nextQuery}。正在開啟系統瀏覽器。`;
    setStatus(message);
    await speakText(message);
    await openBrowser(nextQuery);
  }, [openBrowser]);
  const voice = useVoiceCapture({ onTranscript: handleTranscript });

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.page}>
        <Text accessibilityRole="header" style={styles.title}>語音瀏覽器</Text>
        <Text style={styles.subtitle}>應用會把語音轉成搜尋字詞或網址，再交給 Android 系統瀏覽器開啟。它不會代替你登入、填表或進行付款等操作。</Text>
        <TextInput
          accessibilityLabel="搜尋文字或網站網址"
          accessibilityHint="可輸入網站網址，或輸入想搜尋的文字"
          value={query}
          onChangeText={setQuery}
          placeholder="例如：公車即時動態 或 www.gov.tw"
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={() => void openBrowser()}
          style={styles.input}
        />
        <View accessible accessibilityLabel={`語音瀏覽器狀態：${voice.error || status}`} style={styles.statusCard}>
          <Text style={styles.statusText}>{voice.error || status}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={voice.isRecording ? "停止錄音並辨識語音指令" : "開始語音指令"} onPress={voice.isRecording ? voice.stop : voice.start} disabled={voice.isBusy && !voice.isRecording} style={({ pressed }) => [styles.voiceButton, (pressed || voice.isBusy) && styles.pressed]}>
          {voice.isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{voice.isRecording ? "停止錄音並辨識" : "開始語音指令"}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="開啟系統瀏覽器" accessibilityHint="以目前輸入內容搜尋或開啟網址" onPress={() => void openBrowser()} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>開啟網站</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="停止語音並返回首頁" onPress={() => { void stopSpeaking(); router.back(); }} style={styles.backButton}>
          <Text style={styles.backText}>停止並返回首頁</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingVertical: 22, gap: 16 },
  title: { color: "#0D1B2A", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#475569", fontSize: 17, lineHeight: 26 },
  input: { minHeight: 64, borderWidth: 2, borderColor: "#153D73", borderRadius: 16, paddingHorizontal: 16, color: "#0D1B2A", fontSize: 18, backgroundColor: "#FFFFFF" },
  statusCard: { padding: 16, borderRadius: 16, backgroundColor: "#EEF6FF", borderWidth: 1, borderColor: "#B6D4F2" },
  statusText: { color: "#1E3A5F", fontSize: 17, lineHeight: 25, fontWeight: "600" },
  voiceButton: { minHeight: 64, borderRadius: 18, backgroundColor: "#00A6A6", alignItems: "center", justifyContent: "center" },
  openButton: { minHeight: 64, borderRadius: 18, backgroundColor: "#153D73", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  backButton: { minHeight: 54, alignItems: "center", justifyContent: "center", marginTop: "auto" },
  backText: { color: "#A61B1B", fontWeight: "800", fontSize: 17 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});

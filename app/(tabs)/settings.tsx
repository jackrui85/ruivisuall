import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AccessibilityPreferences, defaultPreferences, getPreferences, savePreferences, speakText, stopSpeaking } from "@/lib/sightguide";

export default function SettingsScreen() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences);

  useEffect(() => { void getPreferences().then(setPreferences); }, []);
  const update = async (patch: Partial<AccessibilityPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    await savePreferences(next);
  };

  return (
    <ScreenContainer className="px-5">
      <ScrollView contentContainerStyle={styles.page}>
        <Text accessibilityRole="header" style={styles.title}>語音與安全設定</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>報讀語速</Text>
          <Text style={styles.cardBody}>目前：{preferences.speechRate === 0.75 ? "較慢" : preferences.speechRate === 1.05 ? "較快" : "標準"}</Text>
          <View style={styles.row}>
            {[{ label: "較慢", value: 0.75 }, { label: "標準", value: 0.9 }, { label: "較快", value: 1.05 }].map((option) => (
              <Pressable key={option.label} accessibilityRole="button" accessibilityLabel={`設定報讀語速為${option.label}`} onPress={() => void update({ speechRate: option.value })} style={[styles.choice, preferences.speechRate === option.value && styles.choiceSelected]}>
                <Text style={[styles.choiceText, preferences.speechRate === option.value && styles.choiceTextSelected]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="試聽目前語速" onPress={() => void speakText("這是目前設定的語音報讀速度。", preferences.speechRate)} style={styles.previewButton}>
            <Text style={styles.previewText}>試聽目前語速</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}><Text style={styles.cardTitle}>完成後自動報讀</Text><Text style={styles.cardBody}>辨識、位置與記事完成時以語音提供結果。</Text></View>
            <Switch accessibilityLabel="完成後自動報讀" value={preferences.autoReadResults} onValueChange={(value) => void update({ autoReadResults: value })} trackColor={{ false: "#94A3B8", true: "#00A6A6" }} />
          </View>
        </View>
        <View accessible accessibilityLabel="安全限制說明" style={styles.warning}>
          <Text style={styles.warningTitle}>安全提醒</Text>
          <Text style={styles.warningText}>影像描述、定位地址與方位皆可能不準確、延遲或無法使用。本應用不提供 3D 深度避障或保證安全的導航；外出時請持續使用白手杖、導盲犬、熟悉的定向行動技巧及其他可靠協助。</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="停止所有語音" onPress={() => void stopSpeaking()} style={styles.stopButton}><Text style={styles.stopText}>停止所有語音</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: 22, gap: 16 },
  title: { color: "#0D1B2A", fontSize: 30, fontWeight: "800" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E0EA", borderRadius: 18, padding: 18, gap: 10 },
  cardTitle: { color: "#0D1B2A", fontSize: 19, fontWeight: "800" },
  cardBody: { color: "#475569", fontSize: 16, lineHeight: 24 },
  row: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, minHeight: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#B9C5D1" },
  choiceSelected: { backgroundColor: "#153D73", borderColor: "#153D73" },
  choiceText: { color: "#153D73", fontWeight: "800" },
  choiceTextSelected: { color: "#FFFFFF" },
  previewButton: { minHeight: 48, borderRadius: 12, backgroundColor: "#DDEDF5", justifyContent: "center", alignItems: "center", marginTop: 2 },
  previewText: { color: "#153D73", fontWeight: "800", fontSize: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  switchText: { flex: 1, gap: 4 },
  warning: { borderRadius: 18, padding: 18, backgroundColor: "#FFF2E4", borderWidth: 1, borderColor: "#F0C38C", gap: 8 },
  warningTitle: { color: "#884600", fontSize: 19, fontWeight: "800" },
  warningText: { color: "#5D3700", fontSize: 16, lineHeight: 25 },
  stopButton: { minHeight: 58, borderRadius: 16, backgroundColor: "#FCE8E8", justifyContent: "center", alignItems: "center" },
  stopText: { color: "#A61B1B", fontSize: 18, fontWeight: "800" },
});

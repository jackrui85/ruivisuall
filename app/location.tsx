import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { speakText, stopSpeaking } from "@/lib/sightguide";

type PositionState = {
  summary: string;
  detail: string;
};

export default function LocationScreen() {
  const [position, setPosition] = useState<PositionState>({
    summary: "尚未取得位置。",
    detail: "按下「取得目前位置」後，應用會向 Android 請求前景定位權限。",
  });
  const [loading, setLoading] = useState(false);

  const announceTime = async () => {
    const now = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    await speakText(`現在時間是 ${now}。`);
  };

  const findLocation = async () => {
    setLoading(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) throw new Error("定位服務目前未開啟，請先在 Android 設定中開啟定位功能。");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("未取得定位權限。你可以在 Android 設定中允許此應用使用位置。 ");
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 });
      const current = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const accuracy = current.coords.accuracy ? `定位精度約正負 ${Math.round(current.coords.accuracy)} 公尺。` : "目前未提供定位精度。";
      const addresses = await Location.reverseGeocodeAsync({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      const first = addresses[0];
      const parts = first ? [first.country, first.region, first.city, first.district, first.street, first.name].filter((part): part is string => Boolean(part)) : [];
      const locationName = parts.length > 0 ? parts.join("，") : "未能取得可報讀的地址";
      const summary = `目前位置：${locationName}。${accuracy}`;
      const detail = `緯度 ${current.coords.latitude.toFixed(5)}，經度 ${current.coords.longitude.toFixed(5)}。${accuracy} 此資訊使用 GPS 或網路定位，只能作為輔助確認，不代表公尺級 3D 定位。`;
      setPosition({ summary, detail });
      await speakText(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "暫時無法取得位置。";
      setPosition({ summary: message, detail: "請確認定位服務、網路與應用權限後再試一次。" });
      await speakText(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>位置與時間</Text>
        <Text style={styles.subtitle}>主動報讀目前時間與前景定位結果。請以白手杖、導盲犬或其他可靠方式確認實際環境。</Text>
        <View accessible accessibilityLabel={`位置資訊：${position.summary}`} style={styles.card}>
          <Text style={styles.cardEyebrow}>目前位置</Text>
          <Text style={styles.cardTitle}>{position.summary}</Text>
          <Text style={styles.cardBody}>{position.detail}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="取得目前位置並報讀" onPress={findLocation} disabled={loading} style={({ pressed }) => [styles.primary, (pressed || loading) && styles.pressed]}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>取得目前位置</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="報讀現在時間" onPress={announceTime} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>報讀現在時間</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="重新報讀位置" onPress={() => void speakText(position.summary)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>重新報讀位置</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="停止語音並返回首頁" onPress={() => { void stopSpeaking(); router.back(); }} style={styles.backButton}>
          <Text style={styles.backText}>停止並返回首頁</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 22, gap: 14 },
  title: { color: "#0D1B2A", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#475569", fontSize: 17, lineHeight: 26 },
  card: { marginTop: 8, padding: 20, borderRadius: 20, backgroundColor: "#E9F4F8", borderWidth: 1, borderColor: "#B6E0E0", gap: 10 },
  cardEyebrow: { color: "#0F766E", fontWeight: "800", fontSize: 15 },
  cardTitle: { color: "#0D1B2A", fontWeight: "800", fontSize: 20, lineHeight: 29 },
  cardBody: { color: "#334155", fontSize: 16, lineHeight: 24 },
  primary: { minHeight: 64, borderRadius: 18, backgroundColor: "#153D73", alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 20 },
  secondary: { minHeight: 58, borderRadius: 16, backgroundColor: "#FFFFFF", borderColor: "#B9C5D1", borderWidth: 1, justifyContent: "center", alignItems: "center" },
  secondaryText: { color: "#153D73", fontWeight: "800", fontSize: 18 },
  backButton: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  backText: { color: "#A61B1B", fontWeight: "800", fontSize: 17 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});

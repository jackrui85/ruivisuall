import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { speakText, stopSpeaking } from "@/lib/sightguide";
import { trpc } from "@/lib/trpc";

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<string>("鏡頭準備中。請將手機後鏡頭朝向想要辨識的方向。");
  const [liveEnabled, setLiveEnabled] = useState(false);
  const liveEnabledRef = useRef(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCapturing = useRef(false);
  const lastLiveMessage = useRef("");
  const analyze = trpc.vision.analyze.useMutation();

  const stopLiveReadout = useCallback(async (announce = true) => {
    liveEnabledRef.current = false;
    setLiveEnabled(false);
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = null;
    if (announce) await speakText("已停止即時環境朗讀。");
  }, []);

  const captureAndDescribe = useCallback(async (live = false) => {
    if (!cameraRef.current || isCapturing.current) return;
    isCapturing.current = true;
    try {
      if (!live) {
        setResult("正在擷取畫面並辨識，請稍候。");
        await speakText("正在辨識目前畫面，請稍候。");
      }
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.35,
        skipProcessing: false,
      });
      if (!photo.base64) throw new Error("相機未能取得可辨識的影像。");
      const data = await analyze.mutateAsync({ imageData: `data:image/jpeg;base64,${photo.base64}` });
      const spoken = data.caution ? `請注意，${data.caution}。${data.summary}` : data.summary;
      setResult(spoken);
      if (!live || spoken !== lastLiveMessage.current) {
        lastLiveMessage.current = spoken;
        await speakText(spoken);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "影像辨識暫時無法完成。";
      setResult(message);
      if (!live) await speakText(message);
    } finally {
      isCapturing.current = false;
      if (live && liveEnabledRef.current) {
        liveTimer.current = setTimeout(() => { void captureAndDescribe(true); }, 7000);
      }
    }
  }, [analyze]);

  const startLiveReadout = async () => {
    liveEnabledRef.current = true;
    lastLiveMessage.current = "";
    setLiveEnabled(true);
    await speakText("已開始即時環境朗讀。系統每七秒擷取一張畫面；請持續以可靠方式確認周遭環境。");
    await captureAndDescribe(true);
  };

  useEffect(() => () => { void stopLiveReadout(false); }, [stopLiveReadout]);

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionTitle}>需要相機權限</Text>
        <Text style={styles.permissionBody}>允許後，才能拍攝目前畫面並提供語音描述。</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="允許使用相機" onPress={requestPermission} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>允許使用相機</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="返回首頁" onPress={() => router.back()} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>返回首頁</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => void speakText("鏡頭已開啟。按描述目前畫面即可開始辨識。")} />
      <View style={styles.topPanel} accessible accessibilityLabel={`環境辨識狀態：${result}`}>
        <Text style={styles.title}>環境辨識</Text>
        <Text numberOfLines={3} style={styles.status}>{result}</Text>
      </View>
      <View style={styles.bottomPanel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={analyze.isPending ? "正在辨識畫面" : "描述目前畫面"}
          accessibilityHint="拍攝一張目前畫面並以語音描述，結果僅供輔助確認"
          disabled={analyze.isPending || liveEnabled}
          onPress={() => void captureAndDescribe(false)}
          style={({ pressed }) => [styles.captureButton, (pressed || analyze.isPending || liveEnabled) && styles.pressed]}
        >
          {analyze.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.captureText}>描述目前畫面</Text>}
        </Pressable>
        <View style={styles.secondaryRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="重新報讀辨識結果" onPress={() => void speakText(result)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>重播結果</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="停止語音並返回首頁" onPress={() => { void stopSpeaking(); router.back(); }} style={styles.stopButton}>
            <Text style={styles.stopText}>停止並返回</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={liveEnabled ? "停止即時環境朗讀" : "開始即時環境朗讀"} accessibilityHint="開啟後每七秒分析一張畫面並報讀變化；再次點擊即可停止" onPress={() => { if (liveEnabled) void stopLiveReadout(); else void startLiveReadout(); }} style={({ pressed }) => [liveEnabled ? styles.liveStopButton : styles.liveButton, pressed && styles.pressed]}>
          <Text style={styles.liveText}>{liveEnabled ? "停止即時朗讀" : "開始即時朗讀"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07101D" },
  center: { flex: 1, backgroundColor: "#07101D", alignItems: "center", justifyContent: "center" },
  permission: { flex: 1, backgroundColor: "#F8FAFC", padding: 28, justifyContent: "center", gap: 18 },
  permissionTitle: { color: "#0D1B2A", fontWeight: "800", fontSize: 28 },
  permissionBody: { color: "#334155", fontSize: 18, lineHeight: 28 },
  topPanel: { marginTop: 54, marginHorizontal: 18, padding: 18, borderRadius: 20, backgroundColor: "rgba(7,16,29,0.88)" },
  title: { color: "#FFFFFF", fontWeight: "800", fontSize: 24 },
  status: { color: "#E2E8F0", marginTop: 8, fontSize: 17, lineHeight: 25 },
  bottomPanel: { marginTop: "auto", padding: 18, paddingBottom: 34, backgroundColor: "rgba(7,16,29,0.92)", gap: 12 },
  captureButton: { minHeight: 70, backgroundColor: "#00A6A6", borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  captureText: { color: "#FFFFFF", fontWeight: "800", fontSize: 22 },
  secondaryRow: { flexDirection: "row", gap: 10 },
  secondaryButton: { flex: 1, minHeight: 54, borderRadius: 14, backgroundColor: "#1E3A5F", justifyContent: "center", alignItems: "center" },
  secondaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  stopButton: { flex: 1, minHeight: 54, borderRadius: 14, backgroundColor: "#7F1D1D", justifyContent: "center", alignItems: "center" },
  stopText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  liveButton: { minHeight: 54, borderRadius: 14, backgroundColor: "#0F766E", justifyContent: "center", alignItems: "center" },
  liveStopButton: { minHeight: 54, borderRadius: 14, backgroundColor: "#A61B1B", justifyContent: "center", alignItems: "center" },
  liveText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  primaryButton: { minHeight: 58, backgroundColor: "#153D73", borderRadius: 16, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  ghostButton: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  ghostButtonText: { color: "#153D73", fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});

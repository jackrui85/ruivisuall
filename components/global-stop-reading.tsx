import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { stopSpeaking } from "@/lib/sightguide";

export function GlobalStopReading() {
  const [stopped, setStopped] = useState(false);

  const handleStop = async () => {
    await stopSpeaking();
    setStopped(true);
    setTimeout(() => setStopped(false), 1800);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={stopped ? "已停止朗讀" : "停止朗讀"}
      accessibilityHint="立即中斷目前正在播放的所有語音內容"
      onPress={() => void handleStop()}
      style={({ pressed }) => [styles.button, (pressed || stopped) && styles.pressed]}
    >
      <Text style={styles.text}>{stopped ? "已停止" : "停止朗讀"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { position: "absolute", top: 18, right: 16, zIndex: 200, minHeight: 48, paddingHorizontal: 15, borderRadius: 24, backgroundColor: "#A61B1B", justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  text: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});

import * as FileSystem from "expo-file-system/legacy";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Platform } from "react-native";
import { useCallback, useEffect, useState } from "react";

import { trpc } from "@/lib/trpc";

const VOICE_NOTE_RECORDING_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: ".m4a",
    sampleRate: 16000,
    outputFormat: "mpeg4" as const,
    audioEncoder: "aac" as const,
    audioSource: "mic" as const,
  },
};

function readableRecordingError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/AudioRecorder\.record|start failed|MediaRecorder/i.test(message)) {
    return "無法啟動麥克風。請確認系統已允許麥克風、關閉其他正在錄音的應用程式，並在模擬器設定中啟用麥克風後再試一次。";
  }
  return message || "無法開始錄音，請確認麥克風未被其他應用程式使用。";
}

type VoiceCaptureOptions = {
  persistAudio?: boolean;
  onTranscript?: (text: string, audioUri?: string) => void | Promise<void>;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}

export function useVoiceCapture(options: VoiceCaptureOptions = {}) {
  const audioRecorder = useAudioRecorder(VOICE_NOTE_RECORDING_PRESET);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [error, setError] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | undefined>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const transcribe = trpc.voice.transcribe.useMutation();

  useEffect(() => {
    if (Platform.OS !== "web") void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setIsPreparing(true);
    try {
      if (Platform.OS !== "web") await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("尚未取得麥克風權限。請在系統設定中允許後再試一次。");
      }
      if (Platform.OS !== "web") await new Promise((resolve) => setTimeout(resolve, 120));
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (captureError) {
      setError(readableRecordingError(captureError));
    } finally {
      setIsPreparing(false);
    }
  }, [audioRecorder]);

  const stop = useCallback(async () => {
    setError(null);
    setIsFinalizing(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("找不到錄音檔案");
      if (Platform.OS === "web") {
        const audioResponse = await fetch(uri);
        if (!audioResponse.ok) throw new Error("Web 預覽無法讀取剛錄製的聲音。");
        const blob = await audioResponse.blob();
        if (blob.size > 16 * 1024 * 1024) throw new Error("錄音檔過大，請將記事內容縮短後再試一次。");
        const response = await transcribe.mutateAsync({
          audioBase64: arrayBufferToBase64(await blob.arrayBuffer()),
          mimeType: blob.type.includes("webm") ? "audio/webm" : "audio/m4a",
        });
        setAudioUri(undefined);
        await options.onTranscript?.(response.text, undefined);
        return;
      }
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error("找不到錄音檔案");
      if ((info.size ?? 0) > 16 * 1024 * 1024) {
        throw new Error("錄音檔過大，請將記事內容縮短後再試一次。");
      }
      const documents = FileSystem.documentDirectory;
      const persistedUri = options.persistAudio && documents
        ? `${documents}sightguide-note-${Date.now()}.m4a`
        : undefined;
      if (persistedUri) await FileSystem.copyAsync({ from: uri, to: persistedUri });
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const response = await transcribe.mutateAsync({
        audioBase64,
        mimeType: "audio/mp4",
      });
      setAudioUri(persistedUri);
      await options.onTranscript?.(response.text, persistedUri);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "語音轉錄失敗，請再試一次。");
    } finally {
      setIsFinalizing(false);
    }
  }, [audioRecorder, options, transcribe]);

  return {
    audioUri,
    error,
    isBusy: isPreparing || isFinalizing || transcribe.isPending,
    isProcessing: isFinalizing || transcribe.isPending,
    isRecording: recorderState.isRecording,
    start,
    stop,
  };
}

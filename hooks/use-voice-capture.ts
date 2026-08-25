import { File, Paths } from "expo-file-system";
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

type VoiceCaptureOptions = {
  persistAudio?: boolean;
  onTranscript?: (text: string, audioUri?: string) => void | Promise<void>;
};

export function useVoiceCapture(options: VoiceCaptureOptions = {}) {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [error, setError] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | undefined>();
  const transcribe = trpc.voice.transcribe.useMutation();

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (Platform.OS === "web") {
      setError("語音錄製請在 Android 裝置上使用。");
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("尚未取得麥克風權限。請在系統設定中允許後再試一次。");
      return;
    }
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setError("無法開始錄音，請確認麥克風未被其他應用程式使用。");
    }
  }, [audioRecorder]);

  const stop = useCallback(async () => {
    setError(null);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("找不到錄音檔案");
      const source = new File(uri);
      if (source.size > 16 * 1024 * 1024) {
        throw new Error("錄音檔過大，請將記事內容縮短後再試一次。");
      }
      const persisted = options.persistAudio
        ? new File(Paths.document, `sightguide-note-${Date.now()}.m4a`)
        : undefined;
      if (persisted) source.copy(persisted);
      const response = await transcribe.mutateAsync({
        audioBase64: await source.base64(),
        mimeType: Platform.OS === "android" ? "audio/mp4" : "audio/m4a",
      });
      const savedUri = persisted?.uri;
      setAudioUri(savedUri);
      await options.onTranscript?.(response.text, savedUri);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "語音轉錄失敗，請再試一次。");
    }
  }, [audioRecorder, options, transcribe]);

  return {
    audioUri,
    error,
    isProcessing: transcribe.isPending,
    isRecording: recorderState.isRecording,
    start,
    stop,
  };
}

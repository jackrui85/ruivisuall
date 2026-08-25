import * as FileSystem from "expo-file-system/legacy";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
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
  const [isPreparing, setIsPreparing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const transcribe = trpc.voice.transcribe.useMutation();

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setIsPreparing(true);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("尚未取得麥克風權限。請在系統設定中允許後再試一次。");
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "無法開始錄音，請確認麥克風未被其他應用程式使用。");
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

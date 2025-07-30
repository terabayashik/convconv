import { Button, Code, Group, JsonInput, NumberInput, Paper, rem, Select, Stack, Text } from "@mantine/core";
import { Dropzone, MIME_TYPES } from "@mantine/dropzone";
import { IconFile, IconUpload, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { getFFmpegPreview } from "../services/api";

interface FileUploadProps {
  onFileSelect: (file: File, outputFormat: string, options?: Record<string, unknown>) => void;
  disabled?: boolean;
}

const VIDEO_FORMATS = [
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WebM" },
  { value: "avi", label: "AVI" },
  { value: "mov", label: "MOV" },
  { value: "mkv", label: "MKV" },
];

const AUDIO_FORMATS = [
  { value: "mp3", label: "MP3" },
  { value: "aac", label: "AAC" },
  { value: "wav", label: "WAV" },
  { value: "flac", label: "FLAC" },
];

const VIDEO_RESOLUTIONS = [
  { value: "1920x1080", label: "1080p (1920x1080)" },
  { value: "1280x720", label: "720p (1280x720)" },
  { value: "854x480", label: "480p (854x480)" },
  { value: "640x360", label: "360p (640x360)" },
  { value: "custom", label: "カスタム" },
];

export const FileUpload = ({ onFileSelect, disabled }: FileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<string>("");
  const [resolution, setResolution] = useState<string>("");
  const [customWidth, setCustomWidth] = useState<number | undefined>();
  const [customHeight, setCustomHeight] = useState<number | undefined>();
  const [ffmpegPreview, setFfmpegPreview] = useState<string>("");

  const handleDrop = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const buildOptions = useCallback((): Record<string, unknown> => {
    const options: Record<string, unknown> = {};

    // Add resolution if it's a video format
    if (!AUDIO_FORMATS.find((f) => f.value === outputFormat) && resolution) {
      if (resolution === "custom" && customWidth && customHeight) {
        options.scale = `${customWidth}x${customHeight}`;
      } else if (resolution !== "custom") {
        options.scale = resolution;
      }
    }

    return options;
  }, [outputFormat, resolution, customWidth, customHeight]);

  const handleConvert = () => {
    if (selectedFile && outputFormat) {
      const options = buildOptions();
      onFileSelect(selectedFile, outputFormat, options);
    }
  };

  const isAudioFile = selectedFile?.type.startsWith("audio/");
  const formats = isAudioFile ? AUDIO_FORMATS : [...VIDEO_FORMATS, ...AUDIO_FORMATS];
  const isVideoFormat = outputFormat && !AUDIO_FORMATS.find((f) => f.value === outputFormat);

  // Build request JSON for preview
  const requestJson =
    selectedFile && outputFormat
      ? JSON.stringify(
          {
            file: `uploads/${selectedFile.name}`,
            outputFormat,
            options: buildOptions(),
          },
          null,
          2,
        )
      : "";

  // Fetch FFmpeg command preview from backend
  useEffect(() => {
    if (!selectedFile || !outputFormat) {
      setFfmpegPreview("");
      return;
    }

    const fetchPreview = async () => {
      try {
        const response = await getFFmpegPreview(`uploads/${selectedFile.name}`, outputFormat, buildOptions());

        if (response.success && response.data) {
          setFfmpegPreview(response.data.command);
        }
      } catch (error) {
        console.error("Failed to fetch FFmpeg preview:", error);
        // Fallback to client-side preview
        let cmd = `ffmpeg -i "${selectedFile.name}"`;

        if (isVideoFormat && resolution) {
          if (resolution === "custom" && customWidth && customHeight) {
            cmd += ` -vf scale=${customWidth}:${customHeight}`;
          } else if (resolution !== "custom") {
            const [w, h] = resolution.split("x");
            cmd += ` -vf scale=${w}:${h}`;
          }
        }

        cmd += ` "output.${outputFormat}"`;
        setFfmpegPreview(cmd);
      }
    };

    fetchPreview();
  }, [selectedFile, outputFormat, resolution, customWidth, customHeight, isVideoFormat, buildOptions]);

  return (
    <Stack>
      <Dropzone
        onDrop={handleDrop}
        maxSize={5 * 1024 ** 3} // 5GB
        accept={[...Object.values(MIME_TYPES).filter((mime) => mime.startsWith("video/") || mime.startsWith("audio/"))]}
        disabled={disabled}
      >
        <Group justify="center" gap="xl" style={{ minHeight: rem(140), pointerEvents: "none" }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(52), height: rem(52), color: "var(--mantine-color-blue-6)" }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX style={{ width: rem(52), height: rem(52), color: "var(--mantine-color-red-6)" }} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFile style={{ width: rem(52), height: rem(52), color: "var(--mantine-color-dimmed)" }} stroke={1.5} />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              ドラッグ＆ドロップまたはクリックしてファイルを選択
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              動画・音声ファイル（最大5GB）
            </Text>
          </div>
        </Group>
      </Dropzone>

      {selectedFile && (
        <Paper p="md" withBorder>
          <Stack>
            <Text size="sm">
              選択されたファイル: <strong>{selectedFile.name}</strong>
            </Text>

            <Select
              label="出力形式"
              placeholder="変換形式を選択"
              data={formats}
              value={outputFormat}
              onChange={(value) => {
                setOutputFormat(value || "");
                setResolution("");
              }}
            />

            {isVideoFormat && (
              <>
                <Select
                  label="解像度"
                  placeholder="解像度を選択"
                  data={VIDEO_RESOLUTIONS}
                  value={resolution}
                  onChange={(value) => setResolution(value || "")}
                />

                {resolution === "custom" && (
                  <Group grow>
                    <NumberInput
                      label="幅"
                      placeholder="1920"
                      min={1}
                      max={7680}
                      value={customWidth}
                      onChange={(value) => setCustomWidth(typeof value === "number" ? value : undefined)}
                    />
                    <NumberInput
                      label="高さ"
                      placeholder="1080"
                      min={1}
                      max={4320}
                      value={customHeight}
                      onChange={(value) => setCustomHeight(typeof value === "number" ? value : undefined)}
                    />
                  </Group>
                )}
              </>
            )}

            {requestJson && (
              <JsonInput
                label="リクエストプレビュー (JSON)"
                value={requestJson}
                readOnly
                autosize
                minRows={4}
                maxRows={10}
              />
            )}

            {ffmpegPreview && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  FFmpegコマンドプレビュー:
                </Text>
                <Code block>{ffmpegPreview}</Code>
              </Stack>
            )}

            <Button onClick={handleConvert} disabled={!outputFormat || disabled} fullWidth>
              変換開始
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

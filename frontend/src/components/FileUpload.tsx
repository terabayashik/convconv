import { Button, Group, Paper, rem, Select, Stack, Text } from "@mantine/core";
import { Dropzone, MIME_TYPES } from "@mantine/dropzone";
import { IconFile, IconUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";

interface FileUploadProps {
  onFileSelect: (file: File, outputFormat: string) => void;
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

export const FileUpload = ({ onFileSelect, disabled }: FileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<string>("");

  const handleDrop = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleConvert = () => {
    if (selectedFile && outputFormat) {
      onFileSelect(selectedFile, outputFormat);
    }
  };

  const isAudioFile = selectedFile?.type.startsWith("audio/");
  const formats = isAudioFile ? AUDIO_FORMATS : [...VIDEO_FORMATS, ...AUDIO_FORMATS];

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
              onChange={(value) => setOutputFormat(value || "")}
            />

            <Button onClick={handleConvert} disabled={!outputFormat || disabled} fullWidth>
              変換開始
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

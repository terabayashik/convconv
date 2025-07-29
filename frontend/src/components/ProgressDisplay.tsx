import { Stack, Progress, Text, Paper, Group, Button } from "@mantine/core";
import { FFmpegProgress } from "@convconv/shared/types/ffmpeg";

interface ProgressDisplayProps {
  progress: FFmpegProgress | null;
  status: "pending" | "processing" | "completed" | "failed";
  downloadUrl?: string;
  onReset: () => void;
}

export const ProgressDisplay = ({ progress, status, downloadUrl, onReset }: ProgressDisplayProps) => {
  return (
    <Paper p="md" withBorder>
      <Stack>
        <Group justify="space-between">
          <Text size="lg" fw={500}>
            変換状況
          </Text>
          <Text size="sm" c="dimmed">
            ステータス: {status}
          </Text>
        </Group>

        {status === "processing" && progress && (
          <>
            <Progress value={progress.percent} size="lg" animated />
            <Group justify="space-between">
              <Text size="sm">進捗: {progress.percent}%</Text>
              <Text size="sm">速度: {progress.speed}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">時間: {progress.time}</Text>
              <Text size="sm">ビットレート: {progress.bitrate}</Text>
            </Group>
          </>
        )}

        {status === "completed" && downloadUrl && (
          <Stack>
            <Text c="green" size="lg" fw={500}>
              変換が完了しました！
            </Text>
            <Group>
              <Button
                component="a"
                href={downloadUrl}
                download
                variant="filled"
              >
                ダウンロード
              </Button>
              <Button variant="light" onClick={onReset}>
                新しいファイルを変換
              </Button>
            </Group>
          </Stack>
        )}

        {status === "failed" && (
          <Stack>
            <Text c="red" size="lg" fw={500}>
              変換に失敗しました
            </Text>
            <Button onClick={onReset}>
              もう一度試す
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};
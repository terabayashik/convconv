import type { FFmpegProgress } from "@convconv/shared/types/ffmpeg";
import { ActionIcon, Button, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";

interface ProgressDisplayProps {
  fileName?: string;
  outputFormat?: string;
  progress: FFmpegProgress | null;
  status: "pending" | "processing" | "completed" | "failed";
  downloadUrl?: string;
  onReset?: () => void;
  onRemove?: () => void;
  compact?: boolean;
}

export const ProgressDisplay = ({
  fileName,
  outputFormat,
  progress,
  status,
  downloadUrl,
  onReset,
  onRemove,
  compact = false,
}: ProgressDisplayProps) => {
  const statusText = {
    pending: "待機中",
    processing: "変換中",
    completed: "完了",
    failed: "失敗",
  }[status];

  const statusColor = {
    pending: "gray",
    processing: "blue",
    completed: "green",
    failed: "red",
  }[status];

  if (compact) {
    return (
      <Paper p="sm" withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={500}>
                {fileName}
              </Text>
              <Text size="xs" c="dimmed">
                {outputFormat?.toUpperCase()} • {statusText}
              </Text>
            </div>
            {onRemove && (
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onRemove}>
                <IconX size={16} />
              </ActionIcon>
            )}
          </Group>

          {status === "processing" && progress && (
            <>
              <Progress value={progress.percent} size="sm" color={statusColor} />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {progress.percent}% • {progress.speed}
                </Text>
                <Text size="xs" c="dimmed">
                  {progress.time}
                </Text>
              </Group>
            </>
          )}

          {status === "completed" && downloadUrl && (
            <Button component="a" href={downloadUrl} download size="xs" fullWidth>
              ダウンロード
            </Button>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack>
        <Group justify="space-between">
          <Text size="lg" fw={500}>
            変換状況
          </Text>
          <Text size="sm" c="dimmed">
            ステータス: {statusText}
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
              <Button component="a" href={downloadUrl} download variant="filled">
                ダウンロード
              </Button>
              {onReset && (
                <Button variant="light" onClick={onReset}>
                  新しいファイルを変換
                </Button>
              )}
            </Group>
          </Stack>
        )}

        {status === "failed" && (
          <Stack>
            <Text c="red" size="lg" fw={500}>
              変換に失敗しました
            </Text>
            {onReset && <Button onClick={onReset}>もう一度試す</Button>}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

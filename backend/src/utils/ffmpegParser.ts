export interface FFmpegProgress {
  percent: number;
  frame?: number;
  fps?: number;
  bitrate?: string;
  speed?: number;
  time?: string;
}

export const parseFFmpegProgress = (data: string, duration?: number): FFmpegProgress | null => {
  // Parse FFmpeg progress output
  const lines = data.split("\n");
  const progress: Partial<FFmpegProgress> = {};

  for (const line of lines) {
    const [key, value] = line.split("=");
    if (!key || !value) continue;

    switch (key.trim()) {
      case "frame":
        progress.frame = Number.parseInt(value, 10);
        break;
      case "fps":
        progress.fps = Number.parseFloat(value);
        break;
      case "bitrate":
        progress.bitrate = value.trim();
        break;
      case "speed":
        progress.speed = Number.parseFloat(value.replace("x", ""));
        break;
      case "out_time_ms": {
        // Convert microseconds to seconds
        const timeSeconds = Number.parseInt(value, 10) / 1000000;
        progress.time = formatTime(timeSeconds);

        // Calculate percentage if duration is provided
        if (duration && duration > 0) {
          progress.percent = Math.min(100, (timeSeconds / duration) * 100);
        }
        break;
      }
    }
  }

  // If we have progress data, return it
  if (Object.keys(progress).length > 0) {
    return {
      percent: progress.percent || 0,
      ...progress,
    };
  }

  return null;
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

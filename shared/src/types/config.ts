export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  storage: {
    uploadDir: string;
    outputDir: string;
    retentionHours: number; // ファイル保持時間（時間単位）
    cleanupIntervalMinutes: number; // クリーンアップ実行間隔（分単位）
  };
  ffmpeg: {
    binaryPath?: string; // FFmpegバイナリのパス（省略時はPATHから検索）
    defaultThreads?: number; // 使用するスレッド数
  };
}

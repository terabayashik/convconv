export interface FFmpegCommand {
  inputFile: string;
  outputFile: string;
  options?: FFmpegOptions;
}

export interface FFmpegOptions {
  codec?: string;
  bitrate?: string;
  format?: string;
  scale?: string;
  customArgs?: string[];
}

export interface FFmpegProgress {
  percent: number;
  time: string;
  bitrate: string;
  speed: string;
}

export interface FFmpegResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  duration?: number;
}

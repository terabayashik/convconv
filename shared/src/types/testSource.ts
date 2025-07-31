export type TestPattern =
  | "smpte"
  | "ebu"
  | "hd"
  | "grayscale"
  | "resolution"
  | "solid"
  | "gradient"
  | "checkerboard"
  | "noise";

export type AudioType = "sine" | "white-noise" | "pink-noise" | "silence";

export type AudioChannel = "mono" | "stereo";

export type SampleRate = 44100 | 48000 | 96000;

export type BitDepth = 16 | 24;

export interface TestSourceOptions {
  pattern: TestPattern;
  resolution: string;
  duration: number;
  frameRate?: number;

  // Audio options
  audioType: AudioType;
  audioFrequency?: number; // For sine wave
  audioChannel: AudioChannel;
  sampleRate: SampleRate;
  bitDepth: BitDepth;

  // Overlay options
  showTimecode?: boolean;
  showFrameCounter?: boolean;
  showMetadata?: boolean;
  customText?: string;

  // Output options
  format: string;
  codec?: string;
  preset?: string;
}

export interface TestSourcePreset {
  id: string;
  name: string;
  description?: string;
  options: TestSourceOptions;
  isBuiltIn: boolean;
}

export interface TestSourceBatch {
  baseOptions: TestSourceOptions;
  variations: {
    resolutions?: string[];
    patterns?: TestPattern[];
    formats?: string[];
  };
}

export interface TestSourceRequest {
  options: TestSourceOptions;
  batch?: TestSourceBatch;
}

export interface TestSourceJob {
  jobId: string;
  type: "test-source";
  options: TestSourceOptions;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  outputPath?: string;
  error?: string;
}

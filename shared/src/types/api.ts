export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConvertRequest {
  file: File | string;
  outputFormat: string;
  options?: Record<string, unknown>;
}

export interface ConvertResponse {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  downloadUrl?: string;
}

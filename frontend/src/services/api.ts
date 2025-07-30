import type { ApiResponse, ConvertRequest, ConvertResponse } from "@convconv/shared/types/api";

// Use relative URL in production, absolute URL in development
const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

export const uploadFile = async (file: File): Promise<ApiResponse<{ filePath: string }>> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  return response.json();
};

export const startConversion = async (
  filePath: string,
  outputFormat: string,
  options?: Record<string, unknown>,
): Promise<ApiResponse<ConvertResponse>> => {
  const request: ConvertRequest = {
    file: filePath,
    outputFormat,
    options,
  };

  const response = await fetch(`${API_BASE_URL}/convert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return response.json();
};

export const getJobStatus = async (jobId: string): Promise<ApiResponse<ConvertResponse>> => {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
  return response.json();
};

export const downloadFile = (jobId: string): string => {
  return `${API_BASE_URL}/download/${jobId}`;
};

export const getFFmpegPreview = async (
  filePath: string,
  outputFormat: string,
  options?: Record<string, unknown>,
): Promise<ApiResponse<{ command: string }>> => {
  const request: ConvertRequest = {
    file: filePath,
    outputFormat,
    options,
  };

  const response = await fetch(`${API_BASE_URL}/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return response.json();
};

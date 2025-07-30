import { Container, MantineProvider, Stack, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import type { FFmpegProgress } from "@convconv/shared/types/ffmpeg";
import { FileUpload } from "./components/FileUpload";
import { ProgressDisplay } from "./components/ProgressDisplay";
import { useWebSocket } from "./hooks/useWebSocket";
import { downloadFile, startConversion, uploadFile } from "./services/api";
import { wsService } from "./services/websocket";

const App = () => {
  const [isConverting, setIsConverting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<FFmpegProgress | null>(null);
  const [status, setStatus] = useState<"pending" | "processing" | "completed" | "failed">("pending");
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();

  // Connect WebSocket on mount
  useEffect(() => {
    wsService.connect().catch(console.error);
    return () => {
      wsService.disconnect();
    };
  }, []);

  // Subscribe to job updates
  useWebSocket(
    jobId,
    (progressData) => {
      setProgress(progressData);
    },
    (_completeData) => {
      setStatus("completed");
      setDownloadUrl(downloadFile(jobId || ""));
    },
    (errorData) => {
      setStatus("failed");
      console.error("Conversion error:", errorData);
    },
  );

  const handleFileSelect = async (file: File, outputFormat: string) => {
    try {
      setIsConverting(true);
      setStatus("processing");
      setProgress(null);

      // Upload file
      const uploadResponse = await uploadFile(file);
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error(uploadResponse.error || "Upload failed");
      }

      // Start conversion
      const convertResponse = await startConversion(uploadResponse.data.filePath, outputFormat);
      if (!convertResponse.success || !convertResponse.data) {
        throw new Error(convertResponse.error || "Conversion failed");
      }

      setJobId(convertResponse.data.jobId);
    } catch (error) {
      console.error("Error:", error);
      setStatus("failed");
      setIsConverting(false);
    }
  };

  const handleReset = () => {
    setIsConverting(false);
    setJobId(null);
    setProgress(null);
    setStatus("pending");
    setDownloadUrl(undefined);
  };

  return (
    <MantineProvider>
      <Container size="sm" py="xl">
        <Stack>
          <Title order={1} ta="center">
            ConvConv - FFmpeg Converter
          </Title>

          {!isConverting ? (
            <FileUpload onFileSelect={handleFileSelect} disabled={isConverting} />
          ) : (
            <ProgressDisplay progress={progress} status={status} downloadUrl={downloadUrl} onReset={handleReset} />
          )}
        </Stack>
      </Container>
    </MantineProvider>
  );
};

export default App;

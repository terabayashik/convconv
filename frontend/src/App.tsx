import { Container, Divider, Grid, MantineProvider, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import type { WSMessage } from "@convconv/shared/schemas/websocket";
import type { FFmpegProgress } from "@convconv/shared/types/ffmpeg";
import { FileUpload } from "./components/FileUpload";
import { ProgressDisplay } from "./components/ProgressDisplay";
import { downloadFile, startConversion, uploadFile } from "./services/api";
import { wsService } from "./services/websocket";

interface Job {
  id: string;
  fileName: string;
  outputFormat: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: FFmpegProgress | null;
  downloadUrl?: string;
}

const App = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());

  // Connect WebSocket on mount
  useEffect(() => {
    console.log("[App] Initializing WebSocket connection...");
    wsService
      .connect()
      .then(() => console.log("[App] WebSocket connection established"))
      .catch((error) => console.error("[App] WebSocket connection failed:", error));

    return () => {
      console.log("[App] Disconnecting WebSocket...");
      wsService.disconnect();
    };
  }, []);

  const handleFileSelect = async (file: File, outputFormat: string, options?: Record<string, unknown>) => {
    console.log(`[App] Starting conversion for file: ${file.name}, format: ${outputFormat}, options:`, options);

    try {
      // Upload file
      console.log("[App] Uploading file...");
      const uploadResponse = await uploadFile(file);
      console.log("[App] Upload response:", uploadResponse);

      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error(uploadResponse.error || "Upload failed");
      }

      // Start conversion
      console.log("[App] Starting conversion with file path:", uploadResponse.data.filePath);
      const convertResponse = await startConversion(uploadResponse.data.filePath, outputFormat, options);
      console.log("[App] Conversion response:", convertResponse);

      if (!convertResponse.success || !convertResponse.data) {
        throw new Error(convertResponse.error || "Conversion failed");
      }

      const jobId = convertResponse.data.jobId;
      console.log("[App] Job created with ID:", jobId);

      // Add job to the list
      const newJob: Job = {
        id: jobId,
        fileName: file.name,
        outputFormat,
        status: "processing",
        progress: null,
      };

      setJobs((prev) => [...prev, newJob]);
      setProcessingJobIds((prev) => new Set(prev).add(jobId));
      console.log("[App] Job added to queue:", newJob);

      // Subscribe to job updates
      wsService.subscribeToJob(jobId, (rawMessage) => {
        console.log(`[WebSocket] Received message for job ${jobId}:`, rawMessage);

        if (typeof rawMessage === "object" && rawMessage !== null && "type" in rawMessage) {
          const message = rawMessage as WSMessage;
          console.log(`[WebSocket] Message type: ${message.type}`);

          if (message.type === "progress" && message.data) {
            console.log("[WebSocket] Progress update:", message.data);
            setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, progress: message.data } : job)));
          } else if (message.type === "complete") {
            console.log(`[WebSocket] Job ${jobId} completed`);
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      status: "completed",
                      downloadUrl: downloadFile(jobId),
                    }
                  : job,
              ),
            );
            setProcessingJobIds((prev) => {
              const newSet = new Set(prev);
              newSet.delete(jobId);
              return newSet;
            });
          } else if (message.type === "error") {
            console.log(`[WebSocket] Job ${jobId} failed:`, message);
            setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status: "failed" } : job)));
            setProcessingJobIds((prev) => {
              const newSet = new Set(prev);
              newSet.delete(jobId);
              return newSet;
            });
          }
        }
      });
    } catch (error) {
      console.error("[App] Error during file conversion:", error);
    }
  };

  const handleRemoveJob = (jobId: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
    wsService.unsubscribeFromJob(jobId, () => {});
  };

  return (
    <MantineProvider>
      <Container size="lg" py="xl">
        <Stack>
          <Title order={1} ta="center">
            ConvConv - FFmpeg Converter
          </Title>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <FileUpload
                onFileSelect={handleFileSelect}
                disabled={processingJobIds.size >= 3} // 最大3つまで同時処理
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper p="md" withBorder>
                <Title order={3} mb="md">
                  変換キュー
                </Title>
                {jobs.length === 0 ? (
                  <Text c="dimmed" ta="center">
                    変換待ちのファイルはありません
                  </Text>
                ) : (
                  <Stack>
                    {jobs.map((job) => (
                      <div key={job.id}>
                        <ProgressDisplay
                          fileName={job.fileName}
                          outputFormat={job.outputFormat}
                          progress={job.progress}
                          status={job.status}
                          downloadUrl={job.downloadUrl}
                          onRemove={() => handleRemoveJob(job.id)}
                          compact
                        />
                        {jobs.indexOf(job) < jobs.length - 1 && <Divider my="sm" />}
                      </div>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    </MantineProvider>
  );
};

export default App;

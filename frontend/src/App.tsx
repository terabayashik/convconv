import { Container, Divider, Grid, MantineProvider, Paper, Stack, Tabs, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import type { WSMessage } from "@convconv/shared/schemas/websocket";
import type { FFmpegProgress } from "@convconv/shared/types/ffmpeg";
import type { TestSourceBatch, TestSourceOptions, TestSourcePreset } from "@convconv/shared/types/testSource";
import { IconTestPipe, IconUpload } from "@tabler/icons-react";
import { FileUpload } from "./components/FileUpload";
import { ProgressDisplay } from "./components/ProgressDisplay";
import { TestSourceGenerator } from "./components/TestSourceGenerator";
import { downloadFile, generateTestSource, getTestSourcePresets, startConversion, uploadFile } from "./services/api";
import { wsService } from "./services/websocket";

interface Job {
  id: string;
  fileName: string;
  outputFormat: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: FFmpegProgress | null;
  downloadUrl?: string;
  type: "convert" | "test-source";
}

const App = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [testSourcePresets, setTestSourcePresets] = useState<TestSourcePreset[]>([]);

  // Connect WebSocket on mount and load presets
  useEffect(() => {
    console.log("[App] Initializing WebSocket connection...");
    wsService
      .connect()
      .then(() => console.log("[App] WebSocket connection established"))
      .catch((error) => console.error("[App] WebSocket connection failed:", error));

    // Load test source presets
    getTestSourcePresets()
      .then((response) => {
        if (response.success && response.data) {
          setTestSourcePresets(response.data.presets);
        }
      })
      .catch((error) => console.error("[App] Failed to load presets:", error));

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
        type: "convert",
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

  const handleTestSourceGenerate = async (options: TestSourceOptions, batch?: TestSourceBatch) => {
    console.log("[App] Generating test source with options:", options);

    try {
      const response = await generateTestSource(options, batch);
      console.log("[App] Test source response:", response);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Test source generation failed");
      }

      if (batch && "jobs" in response.data) {
        // Batch generation
        const jobs = response.data.jobs;
        console.log("[App] Test source batch jobs created:", jobs);

        for (const jobData of jobs) {
          const newJob: Job = {
            id: jobData.jobId,
            fileName: "テストソースバッチ",
            outputFormat: options.format,
            status: "processing",
            progress: null,
            type: "test-source",
          };

          setJobs((prev) => [...prev, newJob]);
          setProcessingJobIds((prev) => new Set(prev).add(jobData.jobId));

          // Subscribe to job updates
          wsService.subscribeToJob(jobData.jobId, createJobUpdateHandler(jobData.jobId));
        }
      } else if ("jobId" in response.data) {
        // Single generation
        const jobId = response.data.jobId;
        console.log("[App] Test source job created with ID:", jobId);

        const newJob: Job = {
          id: jobId,
          fileName: `Test Source (${options.pattern})`,
          outputFormat: options.format,
          status: "processing",
          progress: null,
          type: "test-source",
        };

        setJobs((prev) => [...prev, newJob]);
        setProcessingJobIds((prev) => new Set(prev).add(jobId));

        // Subscribe to job updates
        wsService.subscribeToJob(jobId, createJobUpdateHandler(jobId));
      }
    } catch (error) {
      console.error("[App] Error during test source generation:", error);
    }
  };

  const createJobUpdateHandler = (jobId: string) => (rawMessage: unknown) => {
    console.log(`[WebSocket] Received message for test source job ${jobId}:`, rawMessage);

    if (typeof rawMessage === "object" && rawMessage !== null && "type" in rawMessage) {
      const message = rawMessage as WSMessage;

      if (message.type === "progress" && message.data) {
        setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, progress: message.data } : job)));
      } else if (message.type === "complete") {
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
        setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status: "failed" } : job)));
        setProcessingJobIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
      }
    }
  };

  return (
    <MantineProvider>
      <Container size="lg" py="xl">
        <Stack>
          <Title order={1} ta="center">
            ConvConv - FFmpeg Converter
          </Title>

          <Tabs defaultValue="convert">
            <Tabs.List grow>
              <Tabs.Tab value="convert" leftSection={<IconUpload size={16} />}>
                ファイル変換
              </Tabs.Tab>
              <Tabs.Tab value="test-source" leftSection={<IconTestPipe size={16} />}>
                テストソース生成
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="convert" pt="lg">
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
            </Tabs.Panel>

            <Tabs.Panel value="test-source" pt="lg">
              <Grid>
                <Grid.Col span={{ base: 12, md: 8 }}>
                  <TestSourceGenerator onGenerate={handleTestSourceGenerate} presets={testSourcePresets} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper p="md" withBorder>
                    <Title order={3} mb="md">
                      テストソースジョブ
                    </Title>
                    {jobs.filter((job) => job.type === "test-source").length === 0 ? (
                      <Text c="dimmed" ta="center">
                        テストソースジョブはありません
                      </Text>
                    ) : (
                      <Stack>
                        {jobs
                          .filter((job) => job.type === "test-source")
                          .map((job, index, filteredJobs) => (
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
                              {index < filteredJobs.length - 1 && <Divider my="sm" />}
                            </div>
                          ))}
                      </Stack>
                    )}
                  </Paper>
                </Grid.Col>
              </Grid>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </MantineProvider>
  );
};

export default App;

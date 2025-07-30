import type { ConvertResponse } from "@convconv/shared/types/api";

export interface Job extends ConvertResponse {
  inputPath: string;
  outputPath: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class JobService {
  private jobs: Map<string, Job> = new Map();

  createJob = (inputPath: string, outputPath: string): Job => {
    const jobId = crypto.randomUUID();
    const job: Job = {
      jobId,
      status: "pending",
      inputPath,
      outputPath,
    };

    this.jobs.set(jobId, job);
    return job;
  };

  getJob = (jobId: string): Job | undefined => {
    return this.jobs.get(jobId);
  };

  updateJob = (jobId: string, updates: Partial<Job>): Job | undefined => {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    const updatedJob = { ...job, ...updates };
    this.jobs.set(jobId, updatedJob);
    return updatedJob;
  };

  startJob = (jobId: string): Job | undefined => {
    return this.updateJob(jobId, {
      status: "processing",
      startedAt: new Date(),
    });
  };

  completeJob = (jobId: string, downloadUrl: string): Job | undefined => {
    return this.updateJob(jobId, {
      status: "completed",
      completedAt: new Date(),
      downloadUrl,
      progress: 100,
    });
  };

  failJob = (jobId: string, _error: string): Job | undefined => {
    return this.updateJob(jobId, {
      status: "failed",
      completedAt: new Date(),
    });
  };

  updateProgress = (jobId: string, progress: number): Job | undefined => {
    return this.updateJob(jobId, { progress });
  };
}

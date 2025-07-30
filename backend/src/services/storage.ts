import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";

export class StorageService {
  private uploadDir: string;
  private outputDir: string;
  private retentionMs: number;
  private cleanupInterval?: Timer;

  constructor() {
    this.uploadDir = config.storage.uploadDir;
    this.outputDir = config.storage.outputDir;
    this.retentionMs = config.storage.retentionHours * 60 * 60 * 1000;
  }

  initialize = async () => {
    // Create directories if they don't exist
    await mkdir(this.uploadDir, { recursive: true });
    await mkdir(this.outputDir, { recursive: true });

    // Start cleanup timer
    this.startCleanupTimer();
  };

  saveUploadedFile = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = join(this.uploadDir, fileName);

    await Bun.write(filePath, file);

    return filePath;
  };

  getOutputPath = (inputPath: string, format: string): string => {
    const inputFileName = inputPath.split("/").pop() || "output";
    const baseName = inputFileName.split(".")[0];
    return join(this.outputDir, `${baseName}_output.${format}`);
  };

  private startCleanupTimer = () => {
    const intervalMs = config.storage.cleanupIntervalMinutes * 60 * 1000;

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldFiles();
    }, intervalMs);

    // Run cleanup immediately on start
    this.cleanupOldFiles();
  };

  private cleanupOldFiles = async () => {
    console.log("Running file cleanup...");
    const now = Date.now();

    // Clean upload directory
    await this.cleanupDirectory(this.uploadDir, now);

    // Clean output directory
    await this.cleanupDirectory(this.outputDir, now);
  };

  private cleanupDirectory = async (directory: string, now: number) => {
    try {
      const files = await readdir(directory);

      for (const file of files) {
        const filePath = join(directory, file);
        const fileStat = await stat(filePath);

        if (fileStat.isFile()) {
          const age = now - fileStat.mtimeMs;

          if (age > this.retentionMs) {
            await unlink(filePath);
            console.log(`Deleted old file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error cleaning directory ${directory}:`, error);
    }
  };

  stopCleanup = () => {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  };
}

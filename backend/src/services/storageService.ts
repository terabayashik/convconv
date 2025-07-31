import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config";

class StorageService {
  private uploadDir: string;
  private outputDir: string;

  constructor() {
    this.uploadDir = join(process.cwd(), config.storage.uploadDir);
    this.outputDir = join(process.cwd(), config.storage.outputDir);
    this.ensureDirectories();
  }

  private ensureDirectories = (): void => {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  };

  getUploadDir = (): string => this.uploadDir;
  getOutputDir = (): string => this.outputDir;

  saveUploadedFile = async (file: File): Promise<string> => {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = join(this.uploadDir, fileName);
    await Bun.write(filePath, file);
    return filePath;
  };

  getOutputPath = (inputPath: string, format: string): string => {
    const baseName = inputPath.split("/").pop()?.split(".")[0] || "output";
    const outputName = `${baseName}_${Date.now()}.${format}`;
    return join(this.outputDir, outputName);
  };
}

export const storageService = new StorageService();

import { existsSync } from "node:fs";
import { AppConfigSchema } from "@convconv/shared/schemas/config";
import type { AppConfig } from "@convconv/shared/types/config";

const CONFIG_FILE = "./config.json";
const EXAMPLE_CONFIG_FILE = "./config.example.json";

const createDefaultConfig = async (): Promise<void> => {
  const defaultConfig: AppConfig = {
    server: {
      port: 3000,
      host: "localhost",
    },
    storage: {
      uploadDir: "./uploads",
      outputDir: "./outputs",
      retentionHours: 24,
      cleanupIntervalMinutes: 60,
    },
    ffmpeg: {
      defaultThreads: 4,
    },
  };

  console.log("Creating config.json with default values...");
  await Bun.write(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  console.log("config.json created. You can customize it as needed.");
};

const loadConfig = async (): Promise<AppConfig> => {
  // Check if config.json exists
  if (!existsSync(CONFIG_FILE)) {
    // Try to copy from example file if it exists
    if (existsSync(EXAMPLE_CONFIG_FILE)) {
      const exampleContent = await Bun.file(EXAMPLE_CONFIG_FILE).text();
      await Bun.write(CONFIG_FILE, exampleContent);
      console.log("Created config.json from config.example.json");
    } else {
      // Create with defaults
      await createDefaultConfig();
    }
  }

  // Load and validate config
  try {
    const configFile = await Bun.file(CONFIG_FILE).text();
    const configData = JSON.parse(configFile);
    return AppConfigSchema.parse(configData);
  } catch (error) {
    console.error("Error loading config.json:", error);
    console.log("Using default configuration");
    return AppConfigSchema.parse({});
  }
};

export const config = await loadConfig();

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import elizaLogger from "./logger.js";

elizaLogger.info("Loading embedding settings:", {
    USE_OPENAI_EMBEDDING: process.env.USE_OPENAI_EMBEDDING,
    USE_OLLAMA_EMBEDDING: process.env.USE_OLLAMA_EMBEDDING,
    OLLAMA_EMBEDDING_MODEL:
        process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large",
});

elizaLogger.info("Loading character settings:", {
    CHARACTER_PATH: process.env.CHARACTER_PATH,
    ARGV: process.argv,
    CHARACTER_ARG: process.argv.find((arg) => arg.startsWith("--character=")),
    CWD: process.cwd(),
});

interface Settings {
    [key: string]: string | undefined;
}

let environmentSettings: Settings = {};

const isBrowser = (): boolean => {
    return typeof process === 'undefined' ||
           !process.versions ||
           !process.versions.node;
};

export function findNearestEnvFile(startDir = process.cwd()) {
    if (isBrowser()) return null;

    let currentDir = startDir;

    while (currentDir !== path.parse(currentDir).root) {
        const envPath = path.join(currentDir, ".env");

        if (fs.existsSync(envPath)) {
            return envPath;
        }

        currentDir = path.dirname(currentDir);
    }

    const rootEnvPath = path.join(path.parse(currentDir).root, ".env");
    return fs.existsSync(rootEnvPath) ? rootEnvPath : null;
}

export function configureSettings(settings: Settings) {
    environmentSettings = { ...settings };
}

export function loadEnvConfig(): Settings {
    if (isBrowser()) {
        return environmentSettings;
    }

    const envPath = findNearestEnvFile();

    const result = config(envPath ? { path: envPath } : {});

    if (!result.error) {
        console.log(`Loaded .env file from: ${envPath}`);
    }
    return process.env as Settings;
}

export function getEnvVariable(
    key: string,
    defaultValue?: string
): string | undefined {
    if (isBrowser()) {
        return environmentSettings[key] || defaultValue;
    }
    return process.env[key] || defaultValue;
}

export function hasEnvVariable(key: string): boolean {
    if (isBrowser()) {
        return key in environmentSettings;
    }
    return key in process.env;
}

export const settings = isBrowser() ? environmentSettings : loadEnvConfig();

elizaLogger.info("Parsed settings:", {
    USE_OPENAI_EMBEDDING: settings.USE_OPENAI_EMBEDDING,
    USE_OPENAI_EMBEDDING_TYPE: typeof settings.USE_OPENAI_EMBEDDING,
    USE_OLLAMA_EMBEDDING: settings.USE_OLLAMA_EMBEDDING,
    USE_OLLAMA_EMBEDDING_TYPE: typeof settings.USE_OLLAMA_EMBEDDING,
    OLLAMA_EMBEDDING_MODEL:
        settings.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large",
});

export default settings;

import dotenv from 'dotenv';
dotenv.config();

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import {readFileSync} from "fs";
import path from "path";
import {existsSync, writeFileSync} from "node:fs";
import {MissingRemoteSecret} from "../errors";

const client = new SecretManagerServiceClient();

/**
 * loadEnv writes the env based on base configuration
 * APP_ENV = 'development' write values from .env.local
 * APP_ENV = 'production' write values from Google Secret Manager
 * * APP_ENV = 'production' will load all keys available in .env.example and Google Secret Manager
 *
 * @param {'development' | 'production'} override
 *
 * @return void
 **/
export async function loadEnv(override?: 'development' | 'production') {
    const modeOverRide = override ?? process.env.APP_ENV;
    if (modeOverRide !== 'production' && modeOverRide !== 'development') throw new Error('APP_ENV must be set to production or development');

    if (modeOverRide === 'production') {
        const keys = getEnvExampleKeys();
        await loadSecretsFromGCP(keys);
    } else if (modeOverRide === 'development') {
        loadSecretsFromLocalEnv();
    }
}

/**
 * Reads .env.example and returns the list of keys defined inside it.
 * Skips comments and blank lines.
 */
export function getEnvExampleKeys(filePath = ".env.example"): string[] {
    const fullPath = path.resolve(process.cwd(), filePath);

    let fileContent: string;
    try {
        fileContent = readFileSync(fullPath, "utf-8");
    } catch (e) {
        throw new Error(`Could not read ${filePath} at ${fullPath}: ${(e as Error).message}`);
    }

    const keys: string[] = [];

    for (const line of fileContent.split("\n")) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) continue;

        const [key] = trimmed.split("=", 1);
        if (key) keys.push(key.trim());
    }

    return keys;
}

/**
 * Load secrets from a local .env.local file (key=value format)
 * Returns a map of key/value pairs.
 */
export function loadSecretsFromLocalEnv(): Record<string, string> {
    const envPath = path.resolve(process.cwd(), ".env.local");

    let fileContent: string;
    try {
        fileContent = readFileSync(envPath, "utf-8");
    } catch (e) {
        throw new Error(`Could not read .env.local at ${envPath}: ${(e as Error).message}`);
    }

    const env: Record<string, string> = {};
    for (const line of fileContent.split("\n")) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) continue;

        const idx = trimmed.indexOf("=");
        if (idx === -1) continue; // skip invalid lines

        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();

        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        console.log(`🔐 Loaded secret: ${key} from .env.local`);
        env[key] = value;
        // Optionally set into process.env
        process.env[key] = value;
    }

    return env;
}

/**
 * Updates secret key/value of the current secret manager system (local or Google Secret Manager)
 *
 * @param {string} key
 * @param {string} value
 *
 * @return {Promise<string | null | undefined>}
 **/
export async function updateSecret(key: string, value: string) {
    const mode = process.env.APP_ENV;
    if (mode !== 'production' && mode !== 'development') throw new Error('APP_ENV must be set to production or development');

    const keys = getEnvExampleKeys();
    if (!keys.includes(key)) throw new Error(`${key} is not a valid environment variable in .env.example`);

    let updated;
    if (mode === "production") {
        updated = await createSecretVersion(key, value);
        // Optional: set locally so this process sees it immediately
        process.env[key] = value;
    } else {
        updated = updateValueInLocalEnv(key, value);
        process.env[key] = value; // immediate use in dev/test
    }

    return updated;
}



/**
 * Load and set variables from Google secret manager
 *
 * @param {string[]} secretKeys
 * @return void
 **/
async function loadSecretsFromGCP(secretKeys: string[]) {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) throw new Error("GCP_PROJECT_ID must be set in .env");

    const missingSecretKeys = [];
    for (const key of secretKeys) {
        try {
            const [version] = await client.accessSecretVersion({
                name: `projects/${projectId}/secrets/${key}/versions/latest`,
            });

            const value = version.payload?.data?.toString();
            if (value) {
                process.env[key] = value;
                console.log(`🔐 Loaded secret: ${key} from Google Secret Manager`);
            } else {
                console.warn(`⚠️ Secret ${key} has no value in Google Secret Manager`);
            }
        } catch (err: any) {
            console.error(`❌ Failed to load secret ${key} from Google Secret Manager`, err.message);
            missingSecretKeys.push(key);
        }
    }

    if (missingSecretKeys.length > 0) throw new MissingRemoteSecret(`❌ Failed to load secrets ${missingSecretKeys.join(', ')} from Google Secret Manager.`);
}

/**
 * Add a new version to an existing secret
 *
 * @param {string} key
 * @param {string} value
 *
 * @return {Promise<string | null | undefined>}
 */
async function createSecretVersion(key: string, value: string): Promise<string | null | undefined> {
    const projectId = await client.getProjectId();
    const parent = `projects/${projectId}/secrets/${key}`;

    const [version] = await client.addSecretVersion({
        parent,
        payload: { data: Buffer.from(value, 'utf8') },
    });

    console.log(`Created new version for secret ${key}: ${version.name}`);
    return version.name;
}

/**
 * Writes the value of a secret key in the local env.
 *
 * @param {string} key
 * @param {string} value
 *
 * @return void
 **/
function updateValueInLocalEnv(key: string, value: string): string | undefined {
    try {
        const envPath = path.resolve(process.cwd(), ".env.local");

        let lines: string[] = [];
        if (existsSync(envPath)) {
            const fileContent = readFileSync(envPath, "utf-8");
            lines = fileContent.split("\n");
        }

        let found = false;
        const updatedLines = lines.map((line) => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith("#")) return line;

            const [currentKey] = trimmed.split("=", 1);
            if (currentKey === key) {
                found = true;
                return `${key}=${value}`;
            }
            return line;
        });

        if (!found) {
            updatedLines.push(`${key}=${value}`);
        }

        writeFileSync(envPath, updatedLines.join("\n"), "utf-8");
        console.log(`.env.local updated: ${key}`);

        return key;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

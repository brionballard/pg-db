import fs from 'fs';
import path from 'path';
import { generateUniqueToken } from "./tokenGenerator";

const appKey = generateUniqueToken();

const ENV_FILE_PATH = path.resolve('.env'); // Adjust path as needed

// Function to write APP_KEY to .env file
function writeAppKeyToEnv(key: string): void {
    try {
        let envFileContent = '';

        // Check if the .env file exists
        if (fs.existsSync(ENV_FILE_PATH)) {
            // Read the .env file content
            envFileContent = fs.readFileSync(ENV_FILE_PATH, 'utf-8');

            // Check if APP_KEY already exists
            if (envFileContent.includes('APP_KEY=')) {
                // Replace the existing APP_KEY value
                envFileContent = envFileContent.replace(/APP_KEY=.*/, `APP_KEY=${key}`);
            } else {
                // Append APP_KEY if it doesn't exist
                envFileContent += `\nAPP_KEY=${key}`;
            }
        } else {
            // Create new content if .env file doesn't exist
            envFileContent = `APP_KEY=${key}`;
        }

        // Write updated content back to the .env file
        fs.writeFileSync(ENV_FILE_PATH, envFileContent, 'utf-8');
        console.log(`APP_KEY has been written to .env file.`);
    } catch (error: any) {
        console.error(`Failed to write APP_KEY to .env file: ${error.message}`);
    }
}

// Call the function to write the APP_KEY
writeAppKeyToEnv(appKey);

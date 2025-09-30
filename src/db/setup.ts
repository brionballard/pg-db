import Database from './db';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { loadEnv } from "../config/secrets";

async function executeSqlFile(filePath: string) {
    const sql = fs.readFileSync(filePath, 'utf-8');
    await Database.query(sql);
}

/**
 * Setup database based on SQL schema directory.
 */
async function setupDatabase() {
    try {
        console.log('Loading environment...')
        await loadEnv();

        console.log('Setting up database...');

        // Read all SQL files in the schema directory
        const schemaDir = path.join(__dirname, 'schema');
        const files = fs.readdirSync(schemaDir)
            .filter(file => file.endsWith('.sql')) // Only include .sql files
            .sort((a, b) => {
                // Sort files based on numeric prefix
                const numA = parseInt(a.split('_')[0], 10);
                const numB = parseInt(b.split('_')[0], 10);
                return numA - numB;
            });

        for (const file of files) {
            const filePath = path.join(schemaDir, file);
            await executeSqlFile(filePath);
            console.log("\x1b[33m", `Executed: ${file}`, "\x1b[0m");
        }

        console.log("\x1b[32m", 'Database setup complete.', "\x1b[0m");
        return;
    } catch (error) {
        console.error('Error setting up database:', error);
    }
}

/**
 * Destroy database tables
 **/
async function teardownDatabase() {
    console.log('Loading environment...')
    await loadEnv();

    if (process.env.APP_ENV !== 'development') {
        console.log('\x1b[31m', 'Cannot tear down database in non-dev environment.', '\x1b[0m');
        return;
    }

    try {
        console.log('Tearing down database...');

        // Read all SQL files in reverse order for teardown
        const schemaDir = path.join(__dirname, 'schema');
        const files = fs.readdirSync(schemaDir)
            .filter(file => file.endsWith('.sql'))
            .sort()
            .reverse();

        for (const file of files) {
            const tableNameWithPrefix = path.basename(file, '.sql');
            const tableName = tableNameWithPrefix.includes('_')
                ? tableNameWithPrefix.split('_').slice(1).join('_') // Remove prefix
                : tableNameWithPrefix;

            await Database.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
            console.log('\x1b[33m', `Dropped table ${tableName}`, '\x1b[33m');
        }

        console.log('\x1b[31m', 'Database teardown complete.', '\x1b[0m');
    } catch (error) {
        console.error('Error tearing down database:', error);
    }
}

// Run setup or teardown based on argument
if (require.main === module) {
    const action = process.argv[2];

    const exit = (code = 0) => Database.close().finally(() => process.exit(code));

    if (action === 'setup') {
        setupDatabase().then(() => exit(0)).catch(() => exit(1));
    } else if (action === 'teardown') {
        teardownDatabase().then(() => exit(0)).catch(() => exit(1));
    } else if (action === 'backup') {
        backupDatabase().then(() => exit(0)).catch(() => exit(1));
    } else {
        console.log("Please provide an action: 'setup', 'teardown', or 'backup'");
        process.exit(1);
    }
}

/**
 * Create a static SQL backup of the database.
 */
async function backupDatabase() {
    return new Promise<void>((resolve, reject) => {
        console.log('Creating database backup...');

        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

        // Construct pg_dump command
        const dumpCommand = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_DATABASE} -p ${process.env.DB_PORT} -F p -f "${backupFile}"`;

        exec(dumpCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Backup failed: ${stderr}`);
                return reject(error);
            }
            console.log(`Database backup created at: ${backupFile}`);
            resolve();
        });
    });
}

export { setupDatabase, teardownDatabase, backupDatabase };

import {Pool, PoolConfig, type QueryResult} from 'pg';
import {setupDatabase, teardownDatabase} from "./setup";
import {decryptTyped, ENCRYPTION_MAPS, encryptTyped, shouldEncrypt} from "./encrypt";

class Database {
    private static instance: Pool | undefined;
    private static activeConfig: PoolConfig | undefined;

    private constructor() {}

    /** Build a PoolConfig from env; supports prefixes like 'DB' or 'REMOTE_DB' */
    private static configFromEnv(prefix: 'DB' | 'REMOTE_DB' = 'DB'): PoolConfig {
        const pick = (k: string, d?: string) =>
            process.env[`${prefix}_${k}`] ?? (prefix === 'DB' ? process.env[k] : undefined) ?? d;

        const host = pick('HOST', '127.0.0.1')!;
        const port = Number(pick('PORT', '5432'));
        const user = pick('USER')!;
        const password = pick('PASSWORD', '');
        const database = pick('DATABASE')!;

        // Using Cloud SQL proxy for remote → no SSL in client
        return { host, port, user, password, database, ssl: false };
    }

    /** Set/override the active PoolConfig; resets the singleton pool */
    public static configure(config: PoolConfig) {
        Database.activeConfig = config;
        if (Database.instance) {
            Database.instance.end().catch(() => {});
            Database.instance = undefined;
        }
    }

    /** Convenience: switch to config from env prefix (e.g., 'REMOTE_DB') */
    public static usePrefix(prefix: 'DB' | 'REMOTE_DB') {
        Database.configure(Database.configFromEnv(prefix));
    }

    /** Temporarily run with a custom config, then restore previous */
    public static async withConfig<T>(config: PoolConfig, fn: () => Promise<T>): Promise<T> {
        const prev = Database.activeConfig;
        Database.configure(config);
        try {
            return await fn();
        } finally {
            // restore previous config
            if (prev) Database.configure(prev);
            else {
                Database.activeConfig = undefined;
                if (Database.instance) {
                    await Database.instance.end().catch(() => {});
                    Database.instance = undefined;
                }
            }
        }
    }

    /** Temporarily run using env prefix (e.g., 'REMOTE_DB'), then restore */
    public static async withPrefix<T>(prefix: 'DB' | 'REMOTE_DB', fn: () => Promise<T>): Promise<T> {
        return Database.withConfig(Database.configFromEnv(prefix), fn);
    }

    public static getInstance(): Pool {
        if (!Database.instance) {
            const cfg = Database.activeConfig ?? Database.configFromEnv('DB');
            Database.instance = new Pool(cfg);

            Database.instance.on('connect', () => {
                if (process.env.NODE_ENV !== 'test') {
                    console.log(
                        '\x1b[32m',
                        `Connected to PostgreSQL at ${cfg.host}:${cfg.port} (${new Date().toISOString()})`,
                        '\x1b[0m'
                    );
                }
            });

            Database.instance.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
                // process.exit(-1) // avoid hard exit in prod
            });
        }
        return Database.instance;
    }

    public static async close(): Promise<typeof Database> {
        if (Database.instance) {
            await Database.instance.end();
            console.log('Database connection closed');
            Database.instance = undefined;
        }
        return Database; // Return Database to allow chaining
    }

    public static async query(text: string, params?: any[]): Promise<QueryResult<any>> {
        const pool: Pool = Database.getInstance();

        const ENC_ENABLED = process.env.FIELD_ENCRYPTION_ENABLED === 'true';

        const command = text.trim().split(/\s+/)[0].toUpperCase();
        const tableMatch = text.match(/into\s+(\w+)|from\s+(\w+)|update\s+(\w+)/i);
        const table = tableMatch ? (tableMatch[1] || tableMatch[2] || tableMatch[3]) : null;
        const encryptionFields = table ? ENCRYPTION_MAPS[table] : [];

        let processedParams = params;

        if (ENC_ENABLED && (command === 'INSERT' || command === 'UPDATE') && params && encryptionFields?.length) {
            const colMatch = text.match(/insert\s+into\s+\w+\s*\(([^)]+)\)/i);
            if (colMatch) {
                const columns = colMatch[1].split(',').map(c => c.trim().replace(/["']/g, ''));
                processedParams = params.map((val, i) => {
                    const col = columns[i];
                    return (encryptionFields.includes(col) && shouldEncrypt(val)) ? encryptTyped(val) : val;
                });
            }
        }

        try {
            const result = await pool.query(text, processedParams);

            if (command === 'SELECT' && encryptionFields?.length) {
                result.rows = result.rows.map(row => {
                    const decrypted: Record<string, any> = {};
                    for (const [key, value] of Object.entries(row)) {
                        if (encryptionFields.includes(key) && typeof value === 'string') {
                            try {
                                decrypted[key] = decryptTyped(value);
                            } catch {
                                decrypted[key] = value;
                            }
                        } else {
                            decrypted[key] = value;
                        }
                    }
                    return decrypted;
                });
            }

            return result;
        } catch (err: any) {
            console.error(`Database query failed: ${err.message}`);
            throw new Error(`Failed to execute query: ${text} with params: ${JSON.stringify(params)}. Error: ${err.message}`);
        }
    }

    public static async setup(): Promise<typeof Database> {
        await setupDatabase();
        return Database;
    }

    public static async teardown(): Promise<typeof Database> {
        await teardownDatabase();
        return Database;
    }
}

export default Database;

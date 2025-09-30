"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const setup_1 = require("./setup");
const encrypt_1 = require("./encrypt");
class Database {
    constructor() { }
    /** Build a PoolConfig from env; supports prefixes like 'DB' or 'REMOTE_DB' */
    static configFromEnv(prefix = 'DB') {
        const pick = (k, d) => process.env[`${prefix}_${k}`] ?? (prefix === 'DB' ? process.env[k] : undefined) ?? d;
        const host = pick('HOST', '127.0.0.1');
        const port = Number(pick('PORT', '5432'));
        const user = pick('USER');
        const password = pick('PASSWORD', '');
        const database = pick('DATABASE');
        // Using Cloud SQL proxy for remote → no SSL in client
        return { host, port, user, password, database, ssl: false };
    }
    /** Set/override the active PoolConfig; resets the singleton pool */
    static configure(config) {
        Database.activeConfig = config;
        if (Database.instance) {
            Database.instance.end().catch(() => { });
            Database.instance = undefined;
        }
    }
    /** Convenience: switch to config from env prefix (e.g., 'REMOTE_DB') */
    static usePrefix(prefix) {
        Database.configure(Database.configFromEnv(prefix));
    }
    /** Temporarily run with a custom config, then restore previous */
    static async withConfig(config, fn) {
        const prev = Database.activeConfig;
        Database.configure(config);
        try {
            return await fn();
        }
        finally {
            // restore previous config
            if (prev)
                Database.configure(prev);
            else {
                Database.activeConfig = undefined;
                if (Database.instance) {
                    await Database.instance.end().catch(() => { });
                    Database.instance = undefined;
                }
            }
        }
    }
    /** Temporarily run using env prefix (e.g., 'REMOTE_DB'), then restore */
    static async withPrefix(prefix, fn) {
        return Database.withConfig(Database.configFromEnv(prefix), fn);
    }
    static getInstance() {
        if (!Database.instance) {
            const cfg = Database.activeConfig ?? Database.configFromEnv('DB');
            Database.instance = new pg_1.Pool(cfg);
            Database.instance.on('connect', () => {
                if (process.env.NODE_ENV !== 'test') {
                    console.log('\x1b[32m', `Connected to PostgreSQL at ${cfg.host}:${cfg.port} (${new Date().toISOString()})`, '\x1b[0m');
                }
            });
            Database.instance.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
                // process.exit(-1) // avoid hard exit in prod
            });
        }
        return Database.instance;
    }
    static async close() {
        if (Database.instance) {
            await Database.instance.end();
            console.log('Database connection closed');
            Database.instance = undefined;
        }
        return Database; // Return Database to allow chaining
    }
    static async query(text, params) {
        const pool = Database.getInstance();
        const ENC_ENABLED = process.env.FIELD_ENCRYPTION_ENABLED === 'true';
        const command = text.trim().split(/\s+/)[0].toUpperCase();
        const tableMatch = text.match(/into\s+(\w+)|from\s+(\w+)|update\s+(\w+)/i);
        const table = tableMatch ? (tableMatch[1] || tableMatch[2] || tableMatch[3]) : null;
        const encryptionFields = table ? encrypt_1.ENCRYPTION_MAPS[table] : [];
        let processedParams = params;
        if (ENC_ENABLED && (command === 'INSERT' || command === 'UPDATE') && params && encryptionFields?.length) {
            const colMatch = text.match(/insert\s+into\s+\w+\s*\(([^)]+)\)/i);
            if (colMatch) {
                const columns = colMatch[1].split(',').map(c => c.trim().replace(/["']/g, ''));
                processedParams = params.map((val, i) => {
                    const col = columns[i];
                    return (encryptionFields.includes(col) && (0, encrypt_1.shouldEncrypt)(val)) ? (0, encrypt_1.encryptTyped)(val) : val;
                });
            }
        }
        try {
            const result = await pool.query(text, processedParams);
            if (command === 'SELECT' && encryptionFields?.length) {
                result.rows = result.rows.map(row => {
                    const decrypted = {};
                    for (const [key, value] of Object.entries(row)) {
                        if (encryptionFields.includes(key) && typeof value === 'string') {
                            try {
                                decrypted[key] = (0, encrypt_1.decryptTyped)(value);
                            }
                            catch {
                                decrypted[key] = value;
                            }
                        }
                        else {
                            decrypted[key] = value;
                        }
                    }
                    return decrypted;
                });
            }
            return result;
        }
        catch (err) {
            console.error(`Database query failed: ${err.message}`);
            throw new Error(`Failed to execute query: ${text} with params: ${JSON.stringify(params)}. Error: ${err.message}`);
        }
    }
    static async setup() {
        await (0, setup_1.setupDatabase)();
        return Database;
    }
    static async teardown() {
        await (0, setup_1.teardownDatabase)();
        return Database;
    }
}
exports.default = Database;

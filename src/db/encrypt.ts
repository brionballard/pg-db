import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.APP_KEY as string; // Must be 32 characters (256 bits)
const IV_LENGTH = 12; // GCM recommended IV size

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be defined and exactly 32 bytes long');
}

type EncryptionMap = {
    table: string;
    fields: string[];
}
const ENCRYPTION_MAPS: Record<EncryptionMap['table'], EncryptionMap['fields']> = {
    // Declare encryption maps
    // [Table Name]: EncryptionMap.fields
    // [UserEncryptionMap.table]: UserEncryptionMap.fields
}

function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);

    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString('base64'); // Combine and encode
}

function decrypt(enc: string): string {
    const data = Buffer.from(enc, 'base64');
    const iv = data.slice(0, IV_LENGTH);
    const tag = data.slice(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = data.slice(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}

function shouldEncrypt(value: any): boolean {
    return typeof value === 'string' || typeof value === 'object'; // e.g. string, JSON
}

function encryptTyped(value: any): string {
    return encrypt(JSON.stringify(value));
}

function decryptTyped(enc: string): any {
    return JSON.parse(decrypt(enc));
}

export {
    ENCRYPTION_MAPS,
    EncryptionMap,
    encrypt,
    decrypt,
    shouldEncrypt,
    encryptTyped,
    decryptTyped
}

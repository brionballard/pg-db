"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENCRYPTION_MAPS = void 0;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.shouldEncrypt = shouldEncrypt;
exports.encryptTyped = encryptTyped;
exports.decryptTyped = decryptTyped;
const crypto_1 = __importDefault(require("crypto"));
const ENCRYPTION_KEY = process.env.APP_KEY; // Must be 32 characters (256 bits)
const IV_LENGTH = 12; // GCM recommended IV size
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be defined and exactly 32 bytes long');
}
const ENCRYPTION_MAPS = {
// Declare encryption maps
// [Table Name]: EncryptionMap.fields
// [UserEncryptionMap.table]: UserEncryptionMap.fields
};
exports.ENCRYPTION_MAPS = ENCRYPTION_MAPS;
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64'); // Combine and encode
}
function decrypt(enc) {
    const data = Buffer.from(enc, 'base64');
    const iv = data.slice(0, IV_LENGTH);
    const tag = data.slice(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = data.slice(IV_LENGTH + 16);
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}
function shouldEncrypt(value) {
    return typeof value === 'string' || typeof value === 'object'; // e.g. string, JSON
}
function encryptTyped(value) {
    return encrypt(JSON.stringify(value));
}
function decryptTyped(enc) {
    return JSON.parse(decrypt(enc));
}

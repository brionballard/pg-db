"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueToken = generateUniqueToken;
function generateUniqueToken(suppress = true) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    if (!suppress) {
        console.log('\x1b[33m', `Generated Key: ${result}`);
    }
    return result;
}

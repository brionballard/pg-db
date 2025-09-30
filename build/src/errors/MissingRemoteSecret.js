"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingRemoteSecret = void 0;
const AppError_1 = require("./AppError");
class MissingRemoteSecret extends AppError_1.AppError {
    constructor(message) {
        super(message, 500);
        this.name = 'MissingRemoteSecret';
        this.message = message;
        this.data = null;
    }
}
exports.MissingRemoteSecret = MissingRemoteSecret;

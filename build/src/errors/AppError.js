"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.isOperational = true; // This can be used to determine if an error should be silently handled or logged
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;

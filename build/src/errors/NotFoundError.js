"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = void 0;
const AppError_1 = require("./AppError");
class NotFoundError extends AppError_1.AppError {
    constructor(message) {
        super(message, 404);
        this.name = 'NotFoundError';
        this.message = message;
        this.data = null;
    }
}
exports.NotFoundError = NotFoundError;

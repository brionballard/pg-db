export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public message: string;
  public errors?: any[];

  constructor (message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.isOperational = true; // This can be used to determine if an error should be silently handled or logged

    Error.captureStackTrace(this, this.constructor);
  }
}


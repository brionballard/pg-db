import { AppError } from './AppError';

export class NotFoundError extends AppError {
  data: null;

  constructor (message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
    this.message = message;
    this.data = null;
  }
}

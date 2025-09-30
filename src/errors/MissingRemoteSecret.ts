import { AppError } from './AppError';

export class MissingRemoteSecret extends AppError {
    data: null;

    constructor (message: string) {
        super(message, 500);
        this.name = 'MissingRemoteSecret';
        this.message = message;
        this.data = null;
    }
}

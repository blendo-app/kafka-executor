import { JobOptions, LogType } from './types';

class Job {
    private canceled: boolean = false;
    private timeout: any = null;
    private rejectExecution: any;
    inputOptions: JobOptions = {};
    public options: JobOptions = {
        maxRetries: 3,
        retryDelay: 60 * 1000,
        logger: (message: string, type: LogType) => {
            console[type](message);
        },
        shouldRetry: true,
    };
    retries: number = 0;
    fn: (...args: any[]) => Promise<any>;

    constructor(fn: (...args: any[]) => Promise<any>, options?: JobOptions) {
        this.fn = fn;
        this.inputOptions = options;
        this.setOptions(options);
    }

    public setOptions(options: JobOptions = {}) {
        Object.assign(this.options, options);
    }

    public exec(...args: any[]) {
        return new Promise((res, rej) => this.runExecution(res, rej, ...args));
    }

    public cancel() {
        this.canceled = true;
        if (this.timeout && this.rejectExecution) {
            clearTimeout(this.timeout);
            this.rejectExecution({ message: 'canceled' });
        }
    }

    private async runExecution(res: any, rej: any, ...args: any[]) {
        try {
            if (this.canceled) {
                return rej({ message: 'canceled' });
            }
            const result = await this.fn(...args);
            res(result);
        } catch (err) {
            const errorResponse = err.response;
            const statusCode = errorResponse && errorResponse.status;
            const shouldRetry = (typeof this.options.shouldRetry === 'function' ?
                this.options.shouldRetry(err)
                : this.options.shouldRetry);
            if (shouldRetry && !this.canceled && this.retries < this.options.maxRetries) {
                this.retries += 1;
                const retryDelay: number = <number>(typeof this.options.retryDelay === 'function' ?
                    this.options.retryDelay(this.retries)
                    : this.options.retryDelay);

                this.options.logger(
                    `An error occurred with message: ${err.message || err} \n Retrying in ${retryDelay / 1000} seconds...`,
                    'warn',
                    'jobRetry'
                );

                await new Promise((resolve) => {
                    this.rejectExecution = rej;
                    this.timeout = setTimeout(() => {
                        resolve(this.runExecution(resolve, rej, ...args));
                        this.timeout = null;
                        this.rejectExecution = null;
                    }, retryDelay);
                });
            } else {
                this.retries = 0;
                rej({
                    message: err.message || err,
                    status: statusCode,
                });
            }
        }
    }

}


export default Job;

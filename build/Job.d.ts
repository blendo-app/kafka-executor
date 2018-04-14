import { JobOptions } from '../index.d';
declare class Job {
    private canceled;
    private timeout;
    private rejectExecution;
    inputOptions: JobOptions;
    options: JobOptions;
    retries: number;
    fn: (...args: any[]) => Promise<any>;
    constructor(fn: (...args: any[]) => Promise<any>, options?: JobOptions);
    setOptions(options?: JobOptions): void;
    exec(...args: any[]): Promise<{}>;
    cancel(): void;
    private runExecution(res, rej, ...args);
}
export default Job;

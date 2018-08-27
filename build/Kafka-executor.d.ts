/// <reference types="node" />
import { KafkaConsumer } from 'node-rdkafka';
import { EventEmitter } from 'events';
import { KafkaExecutorOptions } from './types';
import Job from './Job';
declare class KafkaExecutor {
    private static readonly events;
    private readonly eventEmitter;
    private consumer;
    private resolver;
    private options;
    private status;
    private jobs;
    constructor(options: KafkaExecutorOptions);
    private setupConsumer();
    private setOptions(options);
    init: () => Promise<{}>;
    private checkForMessages();
    private getMessage();
    private processMessage(message);
    private commit(message, error?);
    private executeJobs(message);
    addJob: (jobId: string, job: Job) => void;
    removeJob: (jobId: string) => void;
    private consumerOnReady();
    on(type: string, cl: (...args: any[]) => void): EventEmitter | KafkaConsumer;
    getOffset: (partition?: number) => Promise<any>;
    private cancelJobs();
    shutdown: () => Promise<void | {}>;
    private close;
}
export default KafkaExecutor;

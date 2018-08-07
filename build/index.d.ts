/// <reference types="node" />
declare module "types" {
    import Job from "Job";
    export interface AnyObject {
        [index: string]: any;
    }
    export interface JobItem {
        id: string;
        job: Job;
    }
    export type LogType = 'warn' | 'info' | 'error';
    export type Logger = (message: string, type: LogType, code?: string) => void;
    export type RetryFunction = (retryNumber: number) => number;
    export type ShouldRetry = (err: Error) => boolean;
    export type ErrorHandler = (err: ErrorResponse[], message: KafkaMessage, commit: Function) => void;
    export interface JobOptions {
        maxRetries?: number;
        retryDelay?: number | RetryFunction;
        shouldRetry?: ShouldRetry | boolean;
        logger?: Logger;
    }
    export interface KafkaExecutorOptions extends JobOptions {
        topics: string[];
        brokerList: string;
        groupId: string;
        checkInterval?: number;
        batchSize?: number;
        logger?: Logger;
        errorHandler?: ErrorHandler;
        consumer?: any;
    }
    export interface KafkaMessage {
        value: Buffer;
        size: number;
        topic: string;
        offset: number;
        partition: number;
        key: string;
        timestamp: number;
    }
    export interface ErrorResponse extends Error {
        jobId: string;
        status: number;
    }
}
declare module "Job" {
    import { JobOptions } from "types";
    class Job {
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
}
declare module "Kafka-executor" {
    import { KafkaConsumer } from 'node-rdkafka';
    import { EventEmitter } from 'events';
    import { KafkaExecutorOptions } from "types";
    import Job from "Job";
    class KafkaExecutor {
        private static readonly events;
        private readonly eventEmitter;
        private consumer;
        private interval;
        private resolver;
        private options;
        private logger;
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
        on(type: string, cl: (...args: any[]) => void): KafkaConsumer | EventEmitter;
        getOffset: () => Promise<any>;
        private cancelJobs();
        shutdown: () => Promise<void | {}>;
        private close;
    }
    export default KafkaExecutor;
}
declare module "index" {
    import kafkaExecutor from "Kafka-executor";
    export { default as Job } from "Job";
    export default kafkaExecutor;
}

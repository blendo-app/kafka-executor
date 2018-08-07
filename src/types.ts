import Job from './Job';

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
    value: Buffer; // message contents as a Buffer
    size: number; // size of the message, in bytes
    topic: string; // topic the message comes from
    offset: number; // offset the message was read from
    partition: number; // partition the message was on
    key: string; // key of the message if present
    timestamp: number; // timestamp of message creation
}

export interface ErrorResponse extends Error {
    jobId: string;
    status: number;
}

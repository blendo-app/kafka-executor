/// <reference types="node" />
import Job from './Job';
export interface AnyObject {
    [index: string]: any;
}
export interface JobItem {
    id: string;
    job: Job;
}
export declare type LogType = 'warn' | 'info' | 'error';
export declare type Logger = (message: string, type: LogType, code?: string) => void;
export declare type RetryFunction = (retryNumber: number) => number;
export declare type ShouldRetry = (err: Error) => boolean;
export declare type ErrorHandler = (err: ErrorResponse[], message: KafkaMessage, commit: Function) => void;
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

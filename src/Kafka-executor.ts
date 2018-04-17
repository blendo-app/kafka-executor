import { JobItem, ErrorResponse } from './../index.d';
import { KafkaConsumer } from 'node-rdkafka';
import { EventEmitter } from 'events';
import { AnyObject, KafkaExecutorOptions, LogType, KafkaMessage, JobOptions, Logger } from '../index.d';
import Job from './Job';

class KafkaExecutor {
    private static readonly events: AnyObject = {
        messageReceived: 'message.received',
        messageCommitted: 'message.committed',
        processingError: 'processing.error',
        shutdown: 'shutdown',
    };
    private readonly eventEmitter: EventEmitter = new EventEmitter();
    private consumer: KafkaConsumer;
    private interval: number | null;
    private resolver: Function;
    private options: KafkaExecutorOptions = {
        topics: [],
        brokerList: '',
        groupId: '',
        consumer: {},
        checkInterval: 2000,
        batchSize: 1,
        maxRetries: 3,
        retryDelay: 60000,
        logger: (message: string, type: LogType) => {
            console[type](message);
        },
        errorHandler: () => {
            process.exit(1);
        }
    };

    private logger: Logger;
    private status: 'on' | 'off' = 'off';
    private jobs: JobItem[] = [];
    constructor(options: KafkaExecutorOptions) {
        this.setOptions(options);
        this.setupConsumer();
    }

    private setupConsumer() {
        const { brokerList, groupId, consumer } = this.options;
        this.consumer = new KafkaConsumer({
            ...consumer,
            'metadata.broker.list': brokerList,
            'group.id': groupId,
            'enable.auto.commit': false,
        }, {});
        this.on('event.error', (err) => {
            this.options.logger(err, 'error', 'kafkaError');
        });
    }

    private setOptions(options: KafkaExecutorOptions) {
        Object.assign(this.options, options);
    }

    public init = () => new Promise((resolve, reject) => {
        const handleConnectError = (err: any) => {
            if (err) {
                this.options.logger(err, 'error', 'connectionError');
                reject();
            }
        };
        this.on('ready', () => {
            this.status = 'on';
            this.consumerOnReady();
            this.checkForMessages();
            resolve();
        });
        this.consumer.connect({ timeout: 5000 }, handleConnectError);
        return this;
    })

    private async checkForMessages() {
        if (this.status === 'off') {
            return this.close();
        }
        const messages = await this.getMessage();
        if (messages.length) {
            this.eventEmitter.emit(KafkaExecutor.events.messageReceived, messages);
            for (let i = 0; i < messages.length; i++) {
                await this.processMessage(messages[i]);
            }
            this.checkForMessages();
        } else {
            setTimeout(() => {
                this.checkForMessages();
            }, this.options.checkInterval);
        }
    }

    private getMessage(): Promise<KafkaMessage[]> {
        return new Promise((resolve, reject) => {
            this.consumer.consume(this.options.batchSize, (err: Error, messages: KafkaMessage[]) => {
                if (err) {
                    return reject(err);
                }
                resolve(messages);
            });
        });
    }

    private async processMessage(message: KafkaMessage) {
        try {
            await this.executeJobs(message);
            this.commit(message);
        } catch (error) {
            this.options.logger(error, 'error', 'jobFailed');
            this.eventEmitter.emit(KafkaExecutor.events.processingError, message, error);
            this.options.errorHandler(<ErrorResponse>error , message, this.commit.bind(this));
        }
    }

    private commit(message: KafkaMessage, error?: Error) {
        this.consumer.commitMessageSync(message);
        this.eventEmitter.emit(KafkaExecutor.events.messageCommitted, message);
    }

    private async executeJobs(message: KafkaMessage) {
        const results = await Promise.all(
            this.jobs.map((jobItem: JobItem) => jobItem.job.exec(message)
                .then((res: any) => ({ status: 'success', content: res, id: jobItem.id }))
                .catch((err: any) => ({ status: 'failed', content: { ...err, jobId: jobItem.id } })))
        );
        if (results.some((res: any) => res.status === 'failed')) {
            throw results.filter((res: any) => res.status === 'failed');
        }
    }

    public addJob = (jobId: string, job: Job): void => {
        if (job.constructor.name !== 'Job') {
            throw new Error('The job must be instance of Job');
        }
        job.setOptions(Object.assign({
            maxRetries: this.options.maxRetries,
            retryDelay: this.options.retryDelay,
            logger: this.options.logger,
        }, job.inputOptions));
        this.jobs.push({ id: jobId, job });
    }

    public removeJob = (jobId: string): void => {
        this.jobs = this.jobs.filter((job: JobItem) => job.id !== jobId);
    }

    private consumerOnReady() {
        const { topics } = this.options;
        this.options.logger('Consumer is Ready!', 'info');
        this.consumer.subscribe(topics);
    }

    public on(type: string, cl: (...args: any[]) => void) {
        if (Object.values(KafkaExecutor.events).includes(type)) {
            return this.eventEmitter.on(type, cl);
        }
        return this.consumer.on(type, cl);
    }

    private cancelJobs() {
        this.jobs.forEach((JobItem) => {
            JobItem.job.cancel();
        });
    }

    public shutdown = async () => {
        if (this.status === 'off') {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.cancelJobs();
            this.resolver = resolve;
            this.status = 'off';
            this.options.logger('shuting down...', 'info');
        });
    }

    private close = () => {
        this.consumer.disconnect();
        this.options.logger('Kafka executor closed.', 'info');
        this.eventEmitter.emit(KafkaExecutor.events.shutdown);
        return this.resolver();
    }
}

export default KafkaExecutor;

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
define("types", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("Job", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Job {
        constructor(fn, options) {
            this.canceled = false;
            this.timeout = null;
            this.inputOptions = {};
            this.options = {
                maxRetries: 3,
                retryDelay: 60 * 1000,
                logger: (message, type) => {
                    console[type](message);
                },
                shouldRetry: true,
            };
            this.retries = 0;
            this.fn = fn;
            this.inputOptions = options;
            this.setOptions(options);
        }
        setOptions(options = {}) {
            Object.assign(this.options, options);
        }
        exec(...args) {
            return new Promise((res, rej) => this.runExecution(res, rej, ...args));
        }
        cancel() {
            this.canceled = true;
            if (this.timeout && this.rejectExecution) {
                clearTimeout(this.timeout);
                this.rejectExecution({ message: 'canceled' });
            }
        }
        runExecution(res, rej, ...args) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (this.canceled) {
                        return rej({ message: 'canceled' });
                    }
                    const result = yield this.fn(...args);
                    res(result);
                }
                catch (err) {
                    const errorResponse = err.response;
                    const statusCode = errorResponse && errorResponse.status;
                    const shouldRetry = (typeof this.options.shouldRetry === 'function' ?
                        this.options.shouldRetry(err)
                        : this.options.shouldRetry);
                    if (shouldRetry && !this.canceled && this.retries < this.options.maxRetries) {
                        this.retries += 1;
                        const retryDelay = (typeof this.options.retryDelay === 'function' ?
                            this.options.retryDelay(this.retries)
                            : this.options.retryDelay);
                        this.options.logger(`An error occurred with message: ${err.message || err} \n Retrying in ${retryDelay / 1000} seconds...`, 'warn', 'jobRetry');
                        yield new Promise((resolve) => {
                            this.rejectExecution = rej;
                            this.timeout = setTimeout(() => {
                                resolve(this.runExecution(resolve, rej, ...args));
                                this.timeout = null;
                                this.rejectExecution = null;
                            }, retryDelay);
                        });
                    }
                    else {
                        this.retries = 0;
                        rej({
                            message: err.message || err,
                            status: statusCode,
                        });
                    }
                }
            });
        }
    }
    exports.default = Job;
});
define("Kafka-executor", ["require", "exports", "node-rdkafka", "events"], function (require, exports, node_rdkafka_1, events_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class KafkaExecutor {
        constructor(options) {
            this.eventEmitter = new events_1.EventEmitter();
            this.options = {
                topics: [],
                brokerList: '',
                groupId: '',
                consumer: {},
                checkInterval: 2000,
                batchSize: 1,
                maxRetries: 3,
                retryDelay: 60000,
                logger: (message, type) => {
                    console[type](message);
                },
                errorHandler: () => {
                    process.exit(1);
                }
            };
            this.status = 'off';
            this.jobs = [];
            this.init = () => new Promise((resolve, reject) => {
                const handleConnectError = (err) => {
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
            });
            this.addJob = (jobId, job) => {
                if (job.constructor.name !== 'Job') {
                    throw new Error('The job must be instance of Job');
                }
                job.setOptions(Object.assign({
                    maxRetries: this.options.maxRetries,
                    retryDelay: this.options.retryDelay,
                    logger: this.options.logger,
                }, job.inputOptions));
                this.jobs.push({ id: jobId, job });
            };
            this.removeJob = (jobId) => {
                this.jobs = this.jobs.filter((job) => job.id !== jobId);
            };
            this.getOffset = () => __awaiter(this, void 0, void 0, function* () {
                const { topics, consumer } = this.options;
                const allOffsets = {};
                for (let i = 0; i < topics.length; i++) {
                    const topic = topics[i];
                    allOffsets[topic] = yield new Promise((res, rej) => this.consumer.queryWatermarkOffsets(topic, consumer.partition || null, 1000, function (err, offsets) {
                        if (err) {
                            return rej(err);
                        }
                        res(offsets);
                    }));
                }
                return allOffsets;
            });
            this.shutdown = () => __awaiter(this, void 0, void 0, function* () {
                if (this.status === 'off') {
                    return Promise.resolve();
                }
                return new Promise((resolve) => {
                    this.cancelJobs();
                    this.resolver = resolve;
                    this.status = 'off';
                    this.options.logger('shuting down...', 'info');
                });
            });
            this.close = () => {
                this.consumer.disconnect();
                this.options.logger('Kafka executor closed.', 'info');
                this.eventEmitter.emit(KafkaExecutor.events.shutdown);
                return this.resolver();
            };
            this.setOptions(options);
            this.setupConsumer();
        }
        setupConsumer() {
            const { brokerList, groupId, consumer } = this.options;
            this.consumer = new node_rdkafka_1.KafkaConsumer(Object.assign({}, consumer, { 'metadata.broker.list': brokerList, 'group.id': groupId, 'enable.auto.commit': false }), {});
            this.on('event.error', (err) => {
                this.options.logger(err, 'error', 'kafkaError');
            });
        }
        setOptions(options) {
            Object.assign(this.options, options);
        }
        checkForMessages() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.status === 'off') {
                    return this.close();
                }
                const messages = yield this.getMessage();
                if (messages.length) {
                    this.eventEmitter.emit(KafkaExecutor.events.messageReceived, messages);
                    for (let i = 0; i < messages.length; i++) {
                        yield this.processMessage(messages[i]);
                    }
                    this.checkForMessages();
                }
                else {
                    setTimeout(() => {
                        this.checkForMessages();
                    }, this.options.checkInterval);
                }
            });
        }
        getMessage() {
            return new Promise((resolve, reject) => {
                this.consumer.consume(this.options.batchSize, (err, messages) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(messages);
                });
            });
        }
        processMessage(message) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.executeJobs(message);
                    this.commit(message);
                }
                catch (error) {
                    this.options.logger(error, 'error', 'jobFailed');
                    this.eventEmitter.emit(KafkaExecutor.events.processingError, message, error);
                    this.options.errorHandler(error, message, this.commit.bind(this));
                }
            });
        }
        commit(message, error) {
            this.consumer.commitMessageSync(message);
            this.eventEmitter.emit(KafkaExecutor.events.messageCommitted, message);
        }
        executeJobs(message) {
            return __awaiter(this, void 0, void 0, function* () {
                const results = yield Promise.all(this.jobs.map((jobItem) => jobItem.job.exec(message)
                    .then((res) => ({ status: 'success', content: res, id: jobItem.id }))
                    .catch((err) => ({ status: 'failed', content: Object.assign({}, err, { jobId: jobItem.id }) }))));
                if (results.some((res) => res.status === 'failed')) {
                    throw results.filter((res) => res.status === 'failed').map((err) => err.content);
                }
            });
        }
        consumerOnReady() {
            const { topics } = this.options;
            this.options.logger('Consumer is Ready!', 'info');
            this.consumer.subscribe(topics);
        }
        on(type, cl) {
            if (Object.values(KafkaExecutor.events).includes(type)) {
                return this.eventEmitter.on(type, cl);
            }
            return this.consumer.on(type, cl);
        }
        cancelJobs() {
            this.jobs.forEach((JobItem) => {
                JobItem.job.cancel();
            });
        }
    }
    KafkaExecutor.events = {
        messageReceived: 'message.received',
        messageCommitted: 'message.committed',
        processingError: 'processing.error',
        shutdown: 'shutdown',
    };
    exports.default = KafkaExecutor;
});
define("index", ["require", "exports", "Kafka-executor", "Job"], function (require, exports, Kafka_executor_1, Job_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Job = Job_1.default;
    exports.default = Kafka_executor_1.default;
});

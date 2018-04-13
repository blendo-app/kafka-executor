import KafkaConsumerMock from './mocks/node-rdkafka';
import { spyClass } from './helpers/classMocks';
import Job from '../src/Job';

const mockKafka = (options = {
    connectionError: null,
    consumeData: [],
    consumeError: null,
}) => {
    const { mock, mockFNS } = KafkaConsumerMock(options);
    jest.doMock('node-rdkafka', mock);
    const KafkaExecutor = require('../src/Kafka-executor').default;
    return {
        mockFNS,
        KafkaExecutor: KafkaExecutor,
    };
};
describe('Kafka-executor', () => {
    beforeEach(() => {
        jest.resetModules();
    });
    it('Should create instance with the correct properties', () => {
        const { KafkaExecutor, mockFNS } = mockKafka();
        const topics = ['topic'];
        const spies = spyClass(KafkaExecutor);
        const executor = new KafkaExecutor({
            brokerList: '0.0.0.0:2000',
            groupId: 'group',
            topics: topics,
            consumer: { 'topic.blacklist': 'any' }
        });
        expect(spies.setOptions).toHaveBeenCalled();
        expect(spies.setupConsumer).toHaveBeenCalled();
        expect(mockFNS.constructor).toHaveBeenCalledWith({
            'metadata.broker.list': '0.0.0.0:2000',
            'group.id': 'group',
            'enable.auto.commit': false,
            'topic.blacklist': 'any',
        }, {});
        expect(executor.options).toMatchObject({
            checkInterval: expect.any(Number),
            batchSize: expect.any(Number),
            topics: topics,
            brokerList: '0.0.0.0:2000',
            logger: expect.any(Function),
            groupId: expect.any(String),
            consumer: expect.any(Object),
        });
        const { KafkaConsumer } = require('node-rdkafka');
        expect(executor.consumer).toBeInstanceOf(KafkaConsumer);
        expect(spies.on.mock.calls).toEqual([['event.error', expect.any(Function)]]);
    });
    describe('Init', () => {
        it('Should call the correct flow with correct args', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({});
            await executor.init();
            expect(spies.on).toHaveBeenCalledWith('ready', expect.any(Function));
            expect(mockFNS.connect).toHaveBeenCalled();
            await executor.shutdown();
        });
    });

    describe('connection Error', () => {
        it('Should call the correct flow with correct args', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka({ connectionError: 'ERROR', consumeData: [], consumeError: null, });
            const loggerMock = jest.fn();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({ logger: loggerMock });
            const eventMock = jest.fn();
            executor.on('event.error', eventMock);
            try {
                await executor.init();
            } catch (err) {
                expect(eventMock).toHaveBeenCalled();
            }
        });
    });
    describe('consumerOnReady', () => {
        it('Should call the correct flow with correct args ', () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const loggerMock = jest.fn();
            const topics = ['myTopic'];
            const executor = new KafkaExecutor({ logger: loggerMock, topics });
            executor.consumerOnReady();
            expect(spies.consumerOnReady).toHaveBeenCalled();
            expect(loggerMock).toHaveBeenCalledWith('Consumer is Ready!', 'info');
            expect(mockFNS.subscribe).toBeCalledWith(topics);
        });
    });
    describe('getMessage', () => {
        it('Should call the correct flow with correct args ', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const executor = new KafkaExecutor({});
            await executor.getMessage();
            expect(mockFNS.consume).toHaveBeenCalled();
        });
        it('Should call the correct flow with correct args when there is an error in consumer', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka({
                connectionError: null,
                consumeData: [],
                consumeError: 'ERROR',
            });
            const executor = new KafkaExecutor({});
            try {
                await executor.getMessage();
            } catch (err) {
                expect(err).toBeTruthy();
            }
        });
    });
    describe('checkForMessages', () => {
        it('Should call the correct flow with correct args with on status', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const loggerMock = jest.fn();
            const topics = ['myTopic'];
            const executor = new KafkaExecutor({ logger: loggerMock, topics });
            await executor.init();
            executor.checkForMessages();
            expect(spies.getMessage).toHaveBeenCalled();
            await executor.init();
        });
        it('Should process the messages normally', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const loggerMock = jest.fn();
            const topics = ['myTopic'];
            const executor = new KafkaExecutor({ logger: loggerMock, topics });
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            const message = {
                value: new Buffer('Hello Blendo'),
                size: 100,
                topic: 'myTopic',
                offset: 2,
                partition: 0,
                key: '22',
                timestamp: Date.now(),
            };
            const messages = [message];
            executor.on('message.committed', () => messages.shift());
            executor.getMessage = () => (messages);
            executor.status = 'on';
            await executor.checkForMessages();
            expect(emitterSpy.mock.calls).toEqual([['message.received', messages], ['message.committed', message]]);
            expect(spies.processMessage).toHaveBeenCalledWith(message);
        });
    });
    describe('addJob', () => {
        it('Should call the correct flow with correct args', () => {
            try {
                const { KafkaExecutor, mockFNS } = mockKafka();
                const spies = spyClass(KafkaExecutor);
                const executor = new KafkaExecutor({});
                expect(executor.jobs).toHaveLength(0);
                executor.addJob('test', new Job(() => Promise.resolve()));
                expect(executor.jobs).toHaveLength(1);
            } catch (err) {
                expect(err).toBeFalsy();
            }
        });
        it('Should throw error if not correct job value', () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({});
            expect(executor.jobs).toHaveLength(0);
            try {
                executor.addJob('test', () => Promise.resolve());
            } catch (err) {
                expect(err.message).toBe('The job must be instance of Job');
                expect(executor.jobs).toHaveLength(0);
            }
        });
    });
    describe('removeJob', () => {
        it('Should call the correct flow with correct args', () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({});
            expect(executor.jobs).toHaveLength(0);
            executor.addJob('test', new Job(() => Promise.resolve()));
            expect(executor.jobs).toHaveLength(1);
            executor.removeJob('test');
            expect(executor.jobs).toHaveLength(0);
        });
    });
    describe('commit', () => {
        it('Should call the correct flow with correct args', () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({});
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            const message = {
                value: new Buffer('Hello Blendo'),
                size: 100,
                topic: 'myTopic',
                offset: 2,
                partition: 0,
                key: '22',
                timestamp: Date.now(),
            };
            executor.commit(message);
            expect(mockFNS.commitMessageSync).toHaveBeenCalledWith(message);
            expect(emitterSpy).toHaveBeenCalledWith('message.committed', message);

        });
    });
    describe('processMessage', () => {
        it('Should call the correct flow with correct args if the job succeed', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const loggerMock = jest.fn();
            const topics = ['myTopic'];
            const message = {
                value: new Buffer('Hello Blendo'),
                size: 100,
                topic: 'myTopic',
                offset: 2,
                partition: 0,
                key: '22',
                timestamp: Date.now(),
            };
            const executor = new KafkaExecutor({ logger: loggerMock, topics });
            const mockJob = jest.fn(() => Promise.resolve());
            executor.addJob('test', new Job(mockJob));
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            await executor.processMessage(message);
            expect(mockJob).toHaveBeenCalledWith(message);
            expect(spies.executeJobs).toHaveBeenCalledWith(message);
            expect(spies.commit).toHaveBeenCalledWith(message);
            expect(emitterSpy).toHaveBeenCalledWith('message.committed', message);
        });
        it('Should call the correct flow with correct args if the job failed', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const loggerMock = jest.fn();
            const topics = ['myTopic'];
            const message = {
                value: new Buffer('Hello Blendo'),
                size: 100,
                topic: 'myTopic',
                offset: 2,
                partition: 0,
                key: '22',
                timestamp: Date.now(),
            };
            const executor = new KafkaExecutor({ logger: loggerMock, topics });
            // @ts-ignore
            global.process.exit = jest.fn();
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            const mockJob = jest.fn(() => Promise.reject(''));
            executor.addJob('test', new Job(mockJob, { maxRetries: 0 }));
            await executor.processMessage(message);
            expect(emitterSpy).toHaveBeenCalledWith('processing.error', message, expect.any(Object));
            expect(spies.executeJobs).toHaveBeenCalledWith(message);
            expect(loggerMock).toHaveBeenCalledWith(expect.any(Object), 'error', 'jobFailed');
            expect(global.process.exit).toHaveBeenCalled();
            expect(spies.commit).not.toHaveBeenCalled();
        });

        it('Should call the correct flow with correct args if the job failed and handle the error', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const spies = spyClass(KafkaExecutor);
            const loggerMock = jest.fn();
            const topics = ['myTopic'];
            const message = {
                value: new Buffer('Hello Blendo'),
                size: 100,
                topic: 'myTopic',
                offset: 2,
                partition: 0,
                key: '22',
                timestamp: Date.now(),
            };
            const mockErrorHandler = jest.fn();
            const executor = new KafkaExecutor({ logger: loggerMock, topics, errorHandler: mockErrorHandler });
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            // @ts-ignore
            global.process.exit = jest.fn();
            const mockJob = jest.fn(() => Promise.reject(''));
            executor.addJob('test', new Job(mockJob, { maxRetries: 0 }));
            await executor.processMessage(message);
            expect(mockErrorHandler).toHaveBeenCalledWith(expect.any(Object), message, expect.any(Function));
            expect(spies.executeJobs).toHaveBeenCalledWith(message);
            expect(loggerMock).toHaveBeenCalledWith(expect.any(Object), 'error', 'jobFailed');
            expect(global.process.exit).not.toHaveBeenCalled();
            expect(spies.commit).not.toHaveBeenCalled();
            expect(emitterSpy).toHaveBeenCalledWith('processing.error', message, expect.any(Object));
        });
    });

    describe('shutdown', () => {
        it('Should call the correct flow with correct args', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const loggerMock = jest.fn();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({ logger: loggerMock });
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            executor.addJob('anyId', new Job(() => Promise.resolve()));
            await executor.init();
            await executor.shutdown();
            expect(executor.status).toBe('off');
            expect(emitterSpy).toHaveBeenCalledWith('shutdown');
            expect(loggerMock.mock.calls).toEqual([['Consumer is Ready!', 'info'], ['shuting down...', 'info'], ['Kafka executor closed.', 'info']]);
        });
        it('Should shutdown if status is off', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const loggerMock = jest.fn();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({ logger: loggerMock });
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            executor.addJob('anyId', new Job(() => Promise.resolve()));
            await executor.shutdown();
            expect(executor.status).toBe('off');
            expect(emitterSpy).not.toHaveBeenCalled();
            expect(loggerMock).not.toHaveBeenCalled();
        });
    });

    describe('custom events', () => {
        it('Should call the correct flow with correct args', async () => {
            const { KafkaExecutor, mockFNS } = mockKafka();
            const loggerMock = jest.fn();
            const spies = spyClass(KafkaExecutor);
            const executor = new KafkaExecutor({ logger: loggerMock });
            const emitterSpy = jest.spyOn(executor.eventEmitter, 'emit');
            const customEventFn = jest.fn();
            const customEvents = Object.keys(KafkaExecutor.events).map(event => KafkaExecutor.events[event]);
            customEvents.forEach((event) => {
                executor.on(event, customEventFn);
            });
            customEvents.forEach((event) => {
                executor.eventEmitter.emit(event, event);
            });

            const calledWith = customEvents.map((event) => [event]);
            expect(customEventFn.mock.calls).toEqual(calledWith);
        });
    });
});

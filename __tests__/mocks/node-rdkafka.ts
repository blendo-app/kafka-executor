const { EventEmitter } = require('events');
const { KafkaConsumer } = require('node-rdkafka');

const KafkaConsumerMock = ({
    connectionError = null,
    consumeData = [],
    consumeError = null,
}) => {
    const mockFNS = {
        disconnect: jest.fn(),
        connect: jest.fn((options, cl) => {
            if (cl) {
                cl(connectionError);
            }
            if (connectionError) {
                emitter.emit('event.error');
            } else {
                emitter.emit('ready');
            }
        }),
        on: jest.fn((type, cl) => emitter.on(type, cl)),
        consume: jest.fn((messageNum, cl) => {
            if (cl) {
                cl(consumeError, consumeData);
            }
        }),
        commitMessageSync: jest.fn(),
        subscribe: jest.fn(),
        constructor: jest.fn(),
    };
    const emitter = new EventEmitter();

    return {
        mockFNS,
        mock: () => ({
            KafkaConsumer: class KafkaConsumer {
                constructor(...args) { mockFNS.constructor(...args); return this; }
                on = mockFNS.on;
                connect = mockFNS.connect;
                consume = mockFNS.consume;
                commitMessageSync = mockFNS.commitMessageSync;
                subscribe = mockFNS.subscribe;
                disconnect = mockFNS.disconnect;
            }
        }),
    };
};

export default KafkaConsumerMock;
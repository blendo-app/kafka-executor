const { default: KafkaExecutor, Job } = require('../build')
const executor = new KafkaExecutor({
    topics: ['blendo_user_notifications'],
    brokerList: '0.0.0.0:9092',
    groupId: 'any'
});

let count = 0;

executor.addJob('resolveExample', new Job(() => {
    console.log('process with id: resolveExample executed successfully.')
    if (count === 0) {
        executor.addJob('newJob', new Job(() => {
            console.log('newJob executed');
            return Promise.reject('errrrrrrr')
        }, { retryDelay: 2000 }));
    }
    count++;
    return Promise.resolve()
}));
executor.init();

process.on('SIGINT', async () => {
    await executor.shutdown();
});

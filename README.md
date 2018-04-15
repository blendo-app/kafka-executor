# kafka-executor

---

[Installation](#installation)

[Usage](#usage)

[Documentation](#documentation)

---

#### Features

* Simple API
* Ensures that all the jobs will be executed successfully before a message is committed
* Retry strategy for jobs that fails
* Graceful shutdown


#### Installation

Install with [yarn](https://yarnpkg.com) or [npm](https://www.npmjs.com/)

```sh
yarn add kafka-executor
        #or
npm install kafka-executor --save
```
---

#### Usage

##### Basic

```javascript
import KafkaExecutor, { Job } from 'kafka-executor';

const executor = new KafkaExecutor({
    brokerList:'0.0.0.0:9092,0.0.0.0:9091',
    topics:['topic1','topic2'],
    groupId:'groupId',
});

executor.init();

executor.addJob('myJobId',new Job((kafkaMessage)=>{
    console.log(kafkaMessage);
    return Promise.resolve();
}));


```


# Documentation


### Job


```javascript
import { Job } from 'kafka-executor';

new Job(() => Promise.resolve(), {
    maxRetries?: number,
    retryDelay?: number | (retryNumber: number) => number,
    shouldRetry?: boolean | (err: Error) => boolean,
})

```

| Name  | Required | Default  | Description |
| ------------- | ------------- | ------------- | ------------- |
| maxRetries: number  | no | 3 | How many times must retry until fail |
| retryDelay: number \| (retryIndex)=>number  | no | 60000 ms | The delay between the retries in ms |
| shouldRetry: boolean \| (error)=>boolean | no | true | Determines if a job have to retry in case of failure |


### KafkaExecutor

#### Options

```javascript
import KafkaExecutor from 'kafka-executor';

new KafkaExecutor({
    brokerList: string;
    groupId: string;
    topics: string[];
    checkInterval?: number;
    batchSize?: number;
    errorHandler?: (err: Error, message:KafkaMessage,commit:Function) => void;
    logger?: (message: string, type: LogType, code?: string) => void;
    maxRetries?: number;
    retryDelay?: number;
    consumer?: object;
})

```

| Name  | Required | Default  | Description |
| ------------- | ------------- | ------------- | ------------- |
| brokerList: string  | yes | - | Initial list of brokers as a CSV list of broker host or host:port  |
| topics: [string]  | yes | - | The topics that the consumer will listen to|
| groupId: string | yes | - | Client group id string. All clients sharing the same group.id belong to the same group |
| checkInterval: number | no | 2000 | How match time to wait until check for new messages in case of dead period |
| batchSize: number | no | 1 | How many messages to process concurrently, Change this according to your error tolerance |
| errorHandler: ([error](#error),[kafkaMessage](#kafkamessage),commit:Function)=>void | no | yes | A function responsible for handling job errors. By Default the process will exit with code 1 |
| logger: (message:string, type:'info'\|'warn'\|'error', [code](#codes))=>void | no | console | A function responsible for logging |
| consumer: object | no | - | Options for the consumer see  [rdkafka configuration options](https://github.com/edenhill/librdkafka/blob/0.11.1.x/CONFIGURATION.md) |
| maxRetries: number  | no | 3 | Global configuration for all jobs  |
| retryDelay: number  | no | 60000 ms | Global configuration for all jobs  |



#### Functions

```javascript
import KafkaExecutor from 'kafka-executor';

const executor = new KafkaExecutor({
    brokerList: '0.0.0.0:9092';
    groupId: 'group';
    topics: ['topic'];
});

executor.addJob('myJobId',new Job(...))
executor.init() 
executor.removeJob('myJobId') 
executor.on('event',Function) 
executor.shutdown() 
```


| Name  |  Description |
| ------------- | ------------- |
| init: (jobId:string)=>Promise) | Initialize the kafka-executor and connect consumer with the kafka. |
| addJob: (jobId:string, new [Job](#job)(...))=>void) | Adds a job in the processing flow. |
| removeJob: (jobId:string)=>void) | removes a job. |
| on: (jobId:string)=>void) | Listens in a variant of [events](#events) handled by kafka-executor and rdkafka |
| shutdown: (jobId:string)=>Promise) | shutdown the process gracefully ensuring that the pending jobs will finish before exit |

#### Events

| Event | Arguments | Description |
| ------------- | ------------- | ------------- |
| message.received | [kafkaMessage](#kafkamessage)[] | Fires when the consumer gets a message |
| message.committed | [kafkaMessage](#kafkamessage) | Fires when the consumer commits a message |
| processing.error | [kafkaMessage](#kafkamessage), [error](#error) | Fires when one or more jobs fail |
| shutdown | - | Fires when the kafka-executor shutdown |

#### node-rdkafka events

|Event|Description|
|-------|----------|
|`data` | When using the Standard API consumed messages are emitted in this event. |
|`disconnected` | The `disconnected` event is emitted when the broker disconnects. <br><br>This event is only emitted when `.disconnect` is called. The wrapper will always try to reconnect otherwise. |
|`ready` | The `ready` event is emitted when the `Consumer` is ready to read messages. |
|`event` | The `event` event is emitted when `librdkafka` reports an event (if you opted in via the `event_cb` option).|
|`event.log` | The `event.log` event is emitted when logging events occur (if you opted in for logging  via the `event_cb` option).<br><br> You will need to set a value for `debug` if you want information to send. |
|`event.stats` | The  `event.stats` event is emitted when `librdkafka` reports stats (if you opted in by setting the `statistics.interval.ms` to a non-zero value). |
|`event.throttle` | The `event.throttle` event is emitted when `librdkafka` reports throttling.|

#### kafkaMessage 

```javascript
{
    value: Buffer, 
    size: number,
    topic: string, 
    offset: number, 
    partition: number, 
    key: string, 
    timestamp: number
}
```
| Name | Type | Description |
| ------------- | ------------- | ------------- |
| value | Buffer | message contents as a Buffer |
| size | number | size of the message, in bytes |
| topic | string | topic the message comes from |
| offset | number | offset the message was read from |
| partition | string | partition the message was on |
| key | number | key of the message if present |
| timestamp | number | timestamp of message creation |


#### error 

```javascript
{
    ...Error,
    jobId: string,
    status?: string,
}
```
| Name | type | Description |
| ------------- | ------------- | ------------- |
| jobId  | the failed job |
| status | the http status if exists |

#### codes 

| Name  | Description |
| ------------- | ------------- |
| kafkaError |  Log produced by kafka |
| connectionError | Log produced when trying to connect to kafka |
| jobFailed | Log produced by a job |
| jobRetry | Log produced by a job when retries|


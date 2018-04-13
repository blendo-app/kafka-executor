import Job from '../src/Job';
import { spyClass } from './helpers/classMocks';


describe('Job', () => {
    it('Should initialize correctly', () => {
        const spies = spyClass(Job);
        const fn = () => Promise.resolve();
        const mockLogger = jest.fn();
        const job = new Job(fn, { maxRetries: 1, logger: mockLogger });
        expect(job.fn).toBe(fn);
        expect(spies.setOptions).toBeCalled();
        expect(job.options).toMatchObject({
            maxRetries: 1,
            retryDelay: 60 * 1000,
            logger: mockLogger
        });
    });
    it('Should change options correctly', () => {
        const spies = spyClass(Job);
        const fn = () => Promise.resolve();
        const job = new Job(fn);
        expect(job.fn).toBe(fn);
        expect(spies.setOptions).toBeCalled();
        expect(job.options).toMatchObject({
            maxRetries: 3,
            retryDelay: 60 * 1000
        });
        job.setOptions({ maxRetries: 2 });
        expect(job.options).toMatchObject({
            maxRetries: 2,
            retryDelay: 60 * 1000
        });
    });
    describe('Job Execution', () => {
        it('Should execute the Job correctly', async () => {
            const spies = spyClass(Job);
            const fn = jest.fn(() => Promise.resolve('SUCCESS'));
            const job = new Job(fn);
            const res = await job.exec('an arg');
            expect(spies.runExecution).toBeCalled();
            expect(fn).toBeCalledWith('an arg');
            expect(res).toBe('SUCCESS');
        });
        it('Should execute the Job correctly and handle rejected responses with retries', async () => {
            const spies = spyClass(Job);
            const fn = jest.fn(() => Promise.reject('ERROR'));
            const mockLogger = jest.fn();
            const job = new Job(fn, { maxRetries: 2, retryDelay: 500 });
            try {
                const res = await job.exec('an arg');
            } catch (err) {
                expect(spies.runExecution).toHaveBeenCalledTimes(4);
                expect(err.message).toBe('ERROR');
            }
        });
        it('Should execute the Job correctly with retryDelay as function', async () => {
            const spies = spyClass(Job);
            const fn = jest.fn(() => Promise.reject({ response: { status: 400 }, message: 'ERROR' }));
            const mockLogger = jest.fn();
            const job = new Job(fn, { logger: mockLogger, maxRetries: 2, retryDelay: (retryNumber) => (retryNumber * 500) });
            try {
                const res = await job.exec('an arg');
            } catch (err) {
                expect(spies.runExecution).toBeCalled();
                expect(mockLogger).toHaveBeenCalledTimes(2);
                expect(mockLogger.mock.calls[0][0].includes('Retrying in 0.5 seconds')).toBe(true);
                expect(mockLogger.mock.calls[1][0].includes('Retrying in 1 seconds')).toBe(true);
                expect(err.message).toBe('ERROR');
            }
        });
        it('Should not retry if shouldRetry is a function that returns false', async () => {
            const spies = spyClass(Job);
            const fn = jest.fn(() => Promise.reject({ response: { status: 400 }, message: 'ERROR' }));
            const mockLogger = jest.fn();
            const job = new Job(fn, {
                shouldRetry: (err) => {
                    expect(err.message).toBe('ERROR');
                    return false;
                }, logger: mockLogger, maxRetries: 2, retryDelay: (retryNumber) => (retryNumber * 500)
            });
            try {
                const res = await job.exec('an arg');
            } catch (err) {
                expect(spies.runExecution).toBeCalled();
                expect(mockLogger).toHaveBeenCalledTimes(0);
                expect(err.message).toBe('ERROR');
            }
        });
        it('Should not retry if shouldRetry is false', async () => {
            const spies = spyClass(Job);
            const fn = jest.fn(() => Promise.reject({ response: { status: 400 }, message: 'ERROR' }));
            const mockLogger = jest.fn();
            const job = new Job(fn, { shouldRetry: false, logger: mockLogger, maxRetries: 2, retryDelay: (retryNumber) => (retryNumber * 500) });
            try {
                const res = await job.exec('an arg');
            } catch (err) {
                expect(spies.runExecution).toBeCalled();
                expect(mockLogger).toHaveBeenCalledTimes(0);
                expect(err.message).toBe('ERROR');
            }
        });
        it('Should execute the Job correctly and handle and stop reties if cancel requested', async () => {
            const spies = spyClass(Job);
            const fn = jest.fn(() => Promise.reject('ERROR'));
            const mockLogger = jest.fn();
            const job = new Job(fn, { maxRetries: 3, retryDelay: (retryNumber) => (retryNumber * 1000) });
            try {
                setTimeout(() => {
                    job.cancel();
                }, 1000);
                const res = await job.exec('an arg');
            } catch (error) {
                expect(spies.runExecution).toBeCalled();
                expect(error.message).toBe('canceled');
                try {
                    await job.exec('an arg');
                } catch (err) {
                    expect(err.message).toBe('canceled');
                    const job = new Job(() => Promise.resolve());
                    job.cancel();
                    try {
                        await job.exec();
                    } catch (er) {
                        expect(er.message).toBe('canceled');
                    }
                }
            }
        });
    });
});
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
//# sourceMappingURL=Job.js.map
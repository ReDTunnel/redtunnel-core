export class Task {
    constructor(id, promise, params = [], callback) {
        this.id = id;
        this.params = params;
        this.promise = promise;
        this.callback = callback;
    }
}


export class Queue {
    constructor() {
        this.queue = [];
    }

    empty() {
        return (!this.queue.length);
    }

    put(item) {
        this.queue.push(item);
    }

    get() {
        if (this.empty()) {
            throw "Empty";
        }
        return this.queue.shift();
    }
}


export class Pool {
    constructor(size = 1) {
        this.size = size;

        this._nextId = 0;
        this.results = {};
        this.taskRunning = {};
        this.taskQueue = new Queue();

        const self = this;
        const executeTask = () => {
            if (Object.keys(self.taskRunning).length < self.size) {
                try {
                    const task = self.taskQueue.get();
                    self.taskRunning[task.id] = task;
                    task.promise.apply(null, task.params).then(function (result) {
                        self.results[task.id] = result;
                        if (task.callback) {
                            task.callback(result, null);
                        }
                        delete self.taskRunning[task.id];
                        executeTask();
                    }).catch((error) => {
                        if (task.callback) {
                            task.callback(null, error);
                        }
                    });
                } catch (e) {
                    // console.error(e);
                }
            }
        };

        this.taskQueue.put = function (item) {
            Queue.prototype.put.call(this, item);
            executeTask();
        }

    }

    applyAsync(promise, params = [], callback) {
        this.taskQueue.put(new Task(
            this._nextId++,
            promise,
            params,
            callback
        ));
    }

    mapAsync(promise, iterable, callback) {
        for (let param of iterable) {
            this.applyAsync(
                promise,
                [param]
            )
        }
        return this.done().then(callback);
    }

    reset() {
        this._nextId = 0;
        this.taskRunning = {};
        this.results = {};
        this.taskQueue = new Queue();
    }

    done() {
        const self = this;
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                if (self.taskQueue.empty() && !Object.keys(self.taskRunning).length) {
                    clearInterval(interval);
                    resolve(Object.values(self.results));
                    self.reset();
                }
            }, 500);
        });
    }
}
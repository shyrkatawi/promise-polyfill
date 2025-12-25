type ResolveFn<T> = (value: T | PromiseLike<T>) => void;
type RejectFn = (reason?: any) => void;

type ConstructorExecutor<T> = (resolve: ResolveFn<T>, reject: RejectFn) => void;

export const isObject = (v: unknown): v is object => {
  return typeof v === 'object' && v !== null;
};

export const isFunction = (v: unknown): v is Function => {
  return typeof v === 'function';
};

export const validateConstructorExecutor = <T>(executor: ConstructorExecutor<T>): void | never => {
  if (!isFunction(executor)) {
    throw new TypeError(`Promise executor ${executor} is not a function`);
  }
};

const State = Object.freeze({
  pending: 'pending',
  fulfilled: 'fulfilled',
  rejected: 'rejected',
} as const);

type StateType = (typeof State)[keyof typeof State];

export class MyPromise<T> {
  private state: StateType = State.pending;
  private onFulfilledCbs: Array<() => void> = [];
  private onRejectedCbs: Array<() => void> = [];
  private value: T | any = undefined;

  constructor(executor: ConstructorExecutor<T>) {
    validateConstructorExecutor(executor);

    try {
      this.resolve(executor, this.fulfill.bind(this), this.reject.bind(this));
    } catch (error) {
      this.reject(error);
    }
  }

  private handleResolution(
    promise: MyPromise<T>,
    resolvedValue: T | PromiseLike<T>,
    resolve: ResolveFn<T>,
    reject: RejectFn
  ): void {
    if (promise === resolvedValue) {
      reject(new TypeError('Chaining cycle detected for promise'));
      return;
    }

    if (isObject(resolvedValue) || isFunction(resolvedValue)) {
      let thenCalled = false;

      const resolveFn = (value: T | PromiseLike<T>): void => {
        if (thenCalled) {
          return;
        } else {
          thenCalled = true;
        }
        this.handleResolution(promise, value, resolve, reject);
      };

      const rejectFn = (reason?: any): void => {
        if (thenCalled) {
          return;
        } else {
          thenCalled = true;
        }
        reject(reason);
      };

      try {
        const then = (resolvedValue as any).then;
        if (isFunction(then)) {
          return then.call(resolvedValue, resolveFn, rejectFn);
        }
      } catch (error) {
        return rejectFn(error);
      }
    }

    resolve(resolvedValue as T);
  }

  private fulfill(value: T | PromiseLike<T>): void {
    if (this.state !== State.pending) {
      return;
    }
    this.value = value;
    this.state = State.fulfilled;
    queueMicrotask(() => {
      this.onFulfilledCbs.forEach((fn) => fn());
    });
  }

  private reject(reason?: any): void {
    if (this.state !== State.pending) {
      return;
    }
    this.value = reason;
    this.state = State.rejected;
    queueMicrotask(() => {
      this.onRejectedCbs.forEach((fn) => fn());
    });
  }

  private resolve(executor: ConstructorExecutor<T>, onFulfilled: ResolveFn<T>, onRejected: RejectFn): void {
    executor(
      (value: T | PromiseLike<T>) => {
        this.handleResolution(this, value, onFulfilled, onRejected);
      },
      (reason?: any) => {
        onRejected(reason);
      }
    );
  }

  private callCallback<TResult>(
    value: T,
    callback: (value: T) => TResult | PromiseLike<TResult>,
    resolve: ResolveFn<TResult>,
    reject: RejectFn
  ): void {
    try {
      const result = callback(value);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  public then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): MyPromise<TResult1 | TResult2> {
    const fulfilledHandler = isFunction(onFulfilled) ? onFulfilled : (x: T) => x as unknown as TResult1;
    const rejectedHandler = isFunction(onRejected)
      ? onRejected
      : (r: any) => {
          throw r;
        };

    return new MyPromise<TResult1 | TResult2>((resolve, reject) => {
      if (this.state === State.pending) {
        this.onFulfilledCbs.push(() => {
          this.callCallback(this.value, fulfilledHandler, resolve, reject);
        });
        this.onRejectedCbs.push(() => {
          this.callCallback(this.value, rejectedHandler, resolve, reject);
        });
      }

      if (this.state === State.fulfilled) {
        queueMicrotask(() => {
          this.callCallback(this.value, fulfilledHandler, resolve, reject);
        });
      }

      if (this.state === State.rejected) {
        queueMicrotask(() => {
          this.callCallback(this.value, rejectedHandler, resolve, reject);
        });
      }
    });
  }

  public catch<TResult = never>(
    onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined
  ): MyPromise<T | TResult> {
    return this.then(undefined, onRejected);
  }

  public finally(onFinally?: (() => void) | null | undefined): MyPromise<T> {
    return this.then(
      (value) => {
        if (isFunction(onFinally)) {
          onFinally();
        }
        return value;
      },
      (reason) => {
        if (isFunction(onFinally)) {
          onFinally();
        }
        throw reason;
      }
    );
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `MyPromise { <${this.state}> ${this.value} }`;
  }
}

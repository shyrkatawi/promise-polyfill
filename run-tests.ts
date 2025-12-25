import promisesAplusTests from 'promises-aplus-tests';
import { MyPromise } from './src/my-promise';

const adapter = {
  deferred() {
    let resolve, reject;

    const promise = new MyPromise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return {
      promise,
      resolve,
      reject,
    };
  },
};

process.on('unhandledRejection', (err) => {
  console.debug('unhandledRejection', err);
});

promisesAplusTests(adapter, function (err: unknown) {
  console.log(err);
});

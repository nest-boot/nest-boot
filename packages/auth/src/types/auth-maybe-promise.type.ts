/** A value returned synchronously or asynchronously by an AuthModule callback. */
export type AuthMaybePromise<T> = T | Promise<T>;

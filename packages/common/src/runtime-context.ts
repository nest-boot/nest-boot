import { AsyncLocalStorage } from "async_hooks";
import { Request, Response } from "express";

export class RuntimeContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;

  req?: Request;

  res?: Response;
}

export const runtimeContextStorage = new AsyncLocalStorage<RuntimeContext>();

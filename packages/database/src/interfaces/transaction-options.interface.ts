import { type TransactionOptions as BaseTransactionOptions } from "@mikro-orm/core";

export type TransactionOptions =
  | boolean
  | (BaseTransactionOptions & { alwaysCommit?: boolean });

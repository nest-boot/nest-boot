import { applyDecorators, SetMetadata, UseInterceptors } from "@nestjs/common";

import { TransactionInterceptor } from "../interceptors/transaction.interceptor";

export const TRANSACTION_MODE_METADATA_KEY =
  "__TRANSACTION_MODE_METADATA_KEY__";

export type TransactionMode = "auto" | "manual";

export const Transaction = (
  transactionMode: TransactionMode = "auto"
): MethodDecorator & ClassDecorator => {
  return applyDecorators(
    SetMetadata(TRANSACTION_MODE_METADATA_KEY, transactionMode),
    UseInterceptors(TransactionInterceptor)
  );
};

import { SetMetadata } from "@nestjs/common";

import { TRANSACTION_METADATA_KEY } from "../database.constants";
import { TransactionOptions } from "../interfaces/transaction-options.interface";

export const Transactional = (
  options?: TransactionOptions,
): ClassDecorator & MethodDecorator =>
  SetMetadata(TRANSACTION_METADATA_KEY, options);

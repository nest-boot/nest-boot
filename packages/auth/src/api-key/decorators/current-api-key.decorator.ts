import { createParamDecorator } from "@nestjs/common";

import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";

/** Parameter decorator that injects the API key used for the current request. */
export const CurrentApiKey = createParamDecorator(() => getCurrentApiKey());

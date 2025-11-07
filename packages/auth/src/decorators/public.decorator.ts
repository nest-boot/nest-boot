import { SetMetadata } from "@nestjs/common";

import { IS_PUBLIC_KEY } from "../auth.constants";

export const Public = (value = true) => SetMetadata(IS_PUBLIC_KEY, value);

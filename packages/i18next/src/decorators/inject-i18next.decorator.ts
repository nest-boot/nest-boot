import { Inject } from "@nestjs/common";

import { I18NEXT_INSTANCE } from "../constants";

export function InjectI18next(): ReturnType<typeof Inject> {
  return Inject(I18NEXT_INSTANCE);
}

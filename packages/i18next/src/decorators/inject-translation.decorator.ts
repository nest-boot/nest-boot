import { Inject } from "@nestjs/common";

import { I18NEXT_TRANSLATION } from "../constants";

export function InjectTranslation(): ReturnType<typeof Inject> {
  return Inject(I18NEXT_TRANSLATION);
}

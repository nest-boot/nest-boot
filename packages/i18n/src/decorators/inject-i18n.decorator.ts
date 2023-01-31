import { Inject } from "@nestjs/common";

import { I18N } from "../i18n.constants";

export const InjectI18n = (): ReturnType<typeof Inject> => Inject(I18N);

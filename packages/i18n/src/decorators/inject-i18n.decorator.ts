import { Inject } from "@nestjs/common";

import { I18N } from "../i18n.constants";

/** Decorator that injects the i18next instance into a constructor parameter or property. */
export const InjectI18n = (): ReturnType<typeof Inject> => Inject(I18N);

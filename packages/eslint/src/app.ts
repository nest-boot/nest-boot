import type { Linter } from "eslint";

import { base } from "./base.js";
import nestBoot from "./index.js";

/**
 * Shared ESLint flat configuration preset for Nest Boot applications.
 */
export const app: Linter.Config[] = [...base, ...nestBoot.configs.recommended];

export default app;

import type { Linter } from "eslint";

import base from "./base.js";
import nestBoot from "./index.js";

/**
 * Shared ESLint flat configuration preset for Nest Boot libraries.
 */
const library: Linter.Config[] = [...base, ...nestBoot.configs.recommended];

export default library;

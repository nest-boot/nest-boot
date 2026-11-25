---
"@nest-boot/eslint": minor
---

Merge `@nest-boot/eslint-config` and `@nest-boot/eslint-plugin` into `@nest-boot/eslint`. Import the default `{ configs, plugin }` namespace (or named `configs` and `plugin` exports) and use `configs.recommended` for the full shared flat configuration, `configs.standard` for external JS/TS/JSDoc/Prettier presets only, or `configs.rules` for Nest Boot custom rules only.

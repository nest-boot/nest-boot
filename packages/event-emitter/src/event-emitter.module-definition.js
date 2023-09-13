"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASYNC_OPTIONS_TYPE = exports.OPTIONS_TYPE = exports.MODULE_OPTIONS_TOKEN = exports.ConfigurableModuleClass = exports.SUBSCRIBE_METADATA_KEY = void 0;
var common_1 = require("@nestjs/common");
var crypto_1 = require("crypto");
exports.SUBSCRIBE_METADATA_KEY = (0, crypto_1.randomUUID)();
exports.ConfigurableModuleClass = (_a = new common_1.ConfigurableModuleBuilder()
    .setClassMethodName("forRoot")
    .setExtras({}, function (definition) { return (__assign(__assign({}, definition), { global: true })); })
    .build(), _a.ConfigurableModuleClass), exports.MODULE_OPTIONS_TOKEN = _a.MODULE_OPTIONS_TOKEN, exports.OPTIONS_TYPE = _a.OPTIONS_TYPE, exports.ASYNC_OPTIONS_TYPE = _a.ASYNC_OPTIONS_TYPE;

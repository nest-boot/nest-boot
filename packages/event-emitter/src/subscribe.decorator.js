"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnEvent = exports.Subscribe = void 0;
var common_1 = require("@nestjs/common");
var event_emitter_module_definition_1 = require("./event-emitter.module-definition");
var Subscribe = function (eventName) {
    return (0, common_1.SetMetadata)(event_emitter_module_definition_1.SUBSCRIBE_METADATA_KEY, eventName);
};
exports.Subscribe = Subscribe;
exports.OnEvent = exports.Subscribe;

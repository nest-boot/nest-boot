"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventEmitterHealthIndicator = void 0;
var health_check_1 = require("@nest-boot/health-check");
var health_check_2 = require("@nest-boot/health-check");
var common_1 = require("@nestjs/common");
var redis_info_1 = require("redis-info");
var EventEmitterHealthIndicator = function () {
    var _classDecorators = [(0, common_1.Injectable)({ scope: common_1.Scope.TRANSIENT })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = health_check_2.HealthIndicator;
    var EventEmitterHealthIndicator = _classThis = /** @class */ (function (_super) {
        __extends(EventEmitterHealthIndicator_1, _super);
        function EventEmitterHealthIndicator_1(eventEmitterManager) {
            var _this = _super.call(this) || this;
            _this.eventEmitterManager = eventEmitterManager;
            return _this;
        }
        EventEmitterHealthIndicator_1.prototype.pingCheck = function (key, options) {
            if (options === void 0) { options = {}; }
            return __awaiter(this, void 0, void 0, function () {
                var isHealthy, _a, timeout, _b, memoryMaximumUtilization, err_1;
                var _this = this;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            isHealthy = false;
                            _a = options.timeout, timeout = _a === void 0 ? 1000 : _a, _b = options.memoryMaximumUtilization, memoryMaximumUtilization = _b === void 0 ? 80 : _b;
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, (0, health_check_1.promiseTimeout)(timeout, (function () { return __awaiter(_this, void 0, void 0, function () {
                                    var info, _a, currentMemoryMaximumUtilization;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0:
                                                _a = redis_info_1.parse;
                                                return [4 /*yield*/, this.eventEmitterManager.subscriber.info()];
                                            case 1:
                                                info = _a.apply(void 0, [_b.sent()]);
                                                currentMemoryMaximumUtilization = info.maxmemory === "0"
                                                    ? 0
                                                    : Number(info.used_memory) / Number(info.maxmemory);
                                                if (currentMemoryMaximumUtilization > memoryMaximumUtilization) {
                                                    throw new health_check_2.HealthCheckError("Used memory exceeded the set maximum utilization", this.getStatus(key, isHealthy, {
                                                        message: "Used memory exceeded the set maximum utilization",
                                                    }));
                                                }
                                                return [2 /*return*/, info];
                                        }
                                    });
                                }); })())];
                        case 2:
                            _c.sent();
                            isHealthy = true;
                            return [3 /*break*/, 4];
                        case 3:
                            err_1 = _c.sent();
                            if (err_1 instanceof health_check_2.HealthCheckError) {
                                throw err_1;
                            }
                            if (err_1 instanceof health_check_2.TimeoutError) {
                                throw new health_check_2.TimeoutError(timeout, this.getStatus(key, isHealthy, {
                                    message: "timeout of ".concat(timeout, "ms exceeded"),
                                }));
                            }
                            return [3 /*break*/, 4];
                        case 4:
                            if (isHealthy) {
                                return [2 /*return*/, this.getStatus(key, isHealthy)];
                            }
                            throw new health_check_2.HealthCheckError("".concat(key, " is not available"), this.getStatus(key, isHealthy));
                    }
                });
            });
        };
        return EventEmitterHealthIndicator_1;
    }(_classSuper));
    __setFunctionName(_classThis, "EventEmitterHealthIndicator");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        EventEmitterHealthIndicator = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return EventEmitterHealthIndicator = _classThis;
}();
exports.EventEmitterHealthIndicator = EventEmitterHealthIndicator;

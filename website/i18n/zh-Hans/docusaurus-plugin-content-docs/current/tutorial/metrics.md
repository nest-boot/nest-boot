---
sidebar_position: 14
---

# 指标

`@nest-boot/metrics` 模块使用 [prom-client](https://github.com/siimon/prom-client) 提供 [Prometheus](https://prometheus.io/) 应用指标，并暴露 `/metrics` 端点供抓取。

## 安装

```bash
npm install @nest-boot/metrics prom-client
# 或
pnpm add @nest-boot/metrics prom-client
```

## 基本用法

### 模块注册

在应用模块中注册 `MetricsModule`：

```typescript
import { Module } from "@nestjs/common";
import { MetricsModule } from "@nest-boot/metrics";

@Module({
  imports: [MetricsModule.register({})],
})
export class AppModule {}
```

模块自动：

- 创建 Prometheus `Registry`
- 收集默认 Node.js 指标（CPU、内存、事件循环、GC 等）
- 暴露 `GET /metrics` 端点

## 自定义指标

注入 `Registry` 创建自定义指标：

```typescript
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Counter, Histogram, Registry } from "prom-client";

@Injectable()
export class OrderMetrics implements OnModuleInit {
  private ordersCreated!: Counter;
  private orderDuration!: Histogram;

  constructor(private readonly registry: Registry) {}

  onModuleInit() {
    this.ordersCreated = new Counter({
      name: "orders_created_total",
      help: "Total number of orders created",
      labelNames: ["status"],
      registers: [this.registry],
    });

    this.orderDuration = new Histogram({
      name: "order_processing_duration_seconds",
      help: "Order processing duration in seconds",
      buckets: [0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });
  }

  recordOrderCreated(status: string) {
    this.ordersCreated.inc({ status });
  }

  observeOrderDuration(durationSeconds: number) {
    this.orderDuration.observe(durationSeconds);
  }
}
```

## 示例：请求指标

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Counter, Histogram, Registry } from "prom-client";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly requestCounter: Counter;
  private readonly requestDuration: Histogram;

  constructor(registry: Registry) {
    this.requestCounter = new Counter({
      name: "http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "path", "status"],
      registers: [registry],
    });

    this.requestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration",
      labelNames: ["method", "path"],
      registers: [registry],
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - start) / 1000;
        const res = context.switchToHttp().getResponse();

        this.requestCounter.inc({
          method: req.method,
          path: req.path,
          status: res.statusCode,
        });

        this.requestDuration.observe(
          { method: req.method, path: req.path },
          duration,
        );
      }),
    );
  }
}
```

## Prometheus 配置

在 `prometheus.yml` 中添加抓取目标：

```yaml
scrape_configs:
  - job_name: "nest-app"
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:3000"]
```

## API 参考

查看完整的 [API 文档](/docs/api/@nest-boot/metrics) 获取详细信息。

## 特性

- **默认指标** - 自动收集 Node.js 运行时指标
- **指标端点** - 内置 `GET /metrics` 控制器
- **自定义指标** - 完整的 prom-client API（Counter、Histogram、Gauge、Summary）
- **Prometheus 兼容** - 标准导出格式供抓取

import { Context } from "@nest-boot/common";
import { Injectable, NestMiddleware } from "@nestjs/common";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    // 获取运行上下文
    const ctx = Context.get();

    if (typeof req.headers["x-tenant-id"] === "string") {
      ctx.tenantId = req.headers["x-tenant-id"];
    }

    return next();
  }
}

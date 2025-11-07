import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Response } from "express";

export const CurrentSession = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    let res: Response;

    if (context.getType<"graphql">() === "graphql") {
      res = context.getArgByIndex(2).req.res;
    } else {
      res = context.switchToHttp().getResponse();
    }

    return res.locals.session;
  },
);

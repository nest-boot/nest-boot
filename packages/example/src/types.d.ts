import { User as UserEntity } from "./app/core/entities/user.entity";

export declare global {
  namespace NestBootAuth {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends UserEntity {}
  }
}

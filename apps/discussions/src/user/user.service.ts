import { createEntityService } from "@nest-boot/database";
import { mixinConnection } from "@nest-boot/graphql";
import { mixinSearchable } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";

import { User } from "./user.entity";

/**
 * 用户服务
 *
 * @public
 */
@Injectable()
export class UserService extends mixinConnection(
  mixinSearchable(createEntityService(User), {
    index: "User",
    sortableAttributes: [],
  })
) {}

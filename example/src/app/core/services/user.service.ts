import { mixinConnection } from "@nest-boot/graphql";
import { mixinSearchable } from "@nest-boot/search";

import { User } from "../entities/user.entity";
import { Injectable } from "@nestjs/common";
import { createEntityService } from "@nest-boot/database";

@Injectable()
export class UserService extends mixinConnection(
  mixinSearchable(createEntityService(User), {
    index: "User",
    searchableAttributes: ["name"],
  })
) {}

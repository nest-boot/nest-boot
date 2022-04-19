import { mixinConnection } from "@nest-boot/graphql";
import { mixinSearchable } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";
import { EntityRepository } from "@mikro-orm/core";

import { User } from "../entities/user.entity";

export class UserRepository extends mixinConnection(
  mixinSearchable<User>(EntityRepository)
) {}

import { createConnection } from "@nest-boot/graphql";
import { ObjectType } from "@nestjs/graphql";

import { PostObject } from "./post.object";

@ObjectType()
export class PostConnection extends createConnection(PostObject) {}

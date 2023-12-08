import { ObjectType } from "@nestjs/graphql";

import { Connection } from "./post.connection-definition";

@ObjectType()
export class PostConnection extends Connection {}

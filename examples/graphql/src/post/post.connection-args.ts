import { ArgsType } from "@nestjs/graphql";

import { ConnectionArgs } from "./post.connection-definition";

@ArgsType()
export class PostConnectionArgs extends ConnectionArgs {}

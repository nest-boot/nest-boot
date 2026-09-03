import { Field, InputType } from '@nest-boot/graphql';
import { IsArray, IsString } from 'class-validator';

/** Replaces direct permissions assigned to a workspace member. */
@InputType()
export class SetWorkspaceMemberPermissionsInput {
  /** Complete replacement direct-permission list. */
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String])
  permissions!: string[];
}

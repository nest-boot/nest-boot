import { Field, InputType } from '@nest-boot/graphql';
import {
  ArrayNotContains,
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';

/** Replaces the roles assigned to a workspace member. */
@InputType()
export class UpdateWorkspaceMemberRoleInput {
  /** Complete replacement role list; ownership uses the transfer flow. */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayNotContains(['owner'])
  @IsString({ each: true })
  @Field(() => [String])
  roles!: string[];
}

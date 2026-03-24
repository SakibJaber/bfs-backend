import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  @IsMongoId()
  postId: string;

  @IsNotEmpty()
  @IsString()
  text: string;

  @IsOptional()
  @IsMongoId()
  parentId?: string;
}

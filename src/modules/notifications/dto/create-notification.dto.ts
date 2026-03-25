export class CreateNotificationDto {
  userId: string;
  actorId: string;
  type:
    | 'like'
    | 'comment'
    | 'reply'
    | 'save'
    | 'message'
    | 'warning'
    | 'follow';
  postId?: string;
  messageId?: string;
  message?: string;
}

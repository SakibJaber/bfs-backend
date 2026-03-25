export const NotificationEvents = {
  LIKED: 'notification.liked',
  COMMENTED: 'notification.commented',
  REPLIED: 'notification.replied',
  SAVED: 'notification.saved',
} as const;

export type NotificationEventPayload = {
  userId: string; // recipient
  actorId: string; // who triggered the action
  postId?: string;
  commentId?: string;
};

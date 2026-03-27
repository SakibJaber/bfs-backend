import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<any>,
  ) {}

  async saveMessage(payload: {
    sender: { id: string; role: string };
    receiver: { id: string; role: string };
    text: string;
    images?: string[];
    video?: string;
    videoCover?: string;
  }) {
    const { sender, receiver, text, images, video, videoCover } = payload;

    const senderId = new Types.ObjectId(sender.id);
    const receiverId = new Types.ObjectId(receiver.id);

    // Find or create conversation
    let conversation = await this.conversationModel.findOne({
      'participants.id': { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await this.conversationModel.create({
        participants: [
          { id: senderId, role: sender.role },
          { id: receiverId, role: receiver.role },
        ],
        messages: [],
      });
    }

    // Save message (plain text — no encryption)
    const newMessage = (await this.messageModel.create({
      conversationId: conversation._id,
      sender: { id: senderId, role: sender.role },
      receiver: { id: receiverId, role: receiver.role },
      text: text || '',
      images: images || [],
      video: video || null,
      videoCover: videoCover || null,
      seen: false,
    })) as MessageDocument;

    // Update conversation
    await this.conversationModel.updateOne(
      { _id: (conversation as any)._id },
      {
        $push: { messages: newMessage._id as Types.ObjectId },
        $set: { 'meta.lastActivityAt': new Date() },
      },
    );

    return newMessage.toObject();
  }

  async getConversationUpdate(conversationId: string, lastMessage: any) {
    const conversation = (await this.conversationModel
      .findById(new Types.ObjectId(conversationId))
      .lean()) as any;
    if (!conversation) return null;

    return {
      conversationId,
      participants: conversation.participants,
      lastMessage,
      updatedAt: new Date(),
    };
  }

  async markAsRead(conversationId: string, userId: string, role: string) {
    await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        'receiver.id': new Types.ObjectId(userId),
        'receiver.role': role,
        seen: false,
      },
      { $set: { seen: true } },
    );
  }

  async getConversations(
    userId: string,
    role: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const filter: any = { 'participants.id': userObjectId };
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.conversationModel
        .find(filter)
        .sort({ 'meta.lastActivityAt': -1 })
        .skip(skip)
        .limit(limit)
        .select('-messages')
        .lean(),
      this.conversationModel.countDocuments(filter),
    ]);

    if (conversations.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    // Collect all other participant IDs
    const otherUserIds: Types.ObjectId[] = [];
    for (const convo of conversations as any[]) {
      for (const p of convo.participants) {
        if (p.id.toString() !== userId) {
          otherUserIds.push(p.id);
        }
      }
    }

    // Batch-fetch user info + last messages in parallel
    const [users, lastMsgAgg] = await Promise.all([
      otherUserIds.length
        ? this.userModel
            .find({ _id: { $in: otherUserIds } })
            .select('_id name profileImage')
            .lean()
        : Promise.resolve([]),

      this.messageModel.aggregate([
        {
          $match: {
            conversationId: { $in: conversations.map((c: any) => c._id) },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$conversationId',
            doc: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$doc' } },
      ]),
    ]);

    // Build lookup maps
    const userInfoMap = new Map(
      (users as any[]).map((u: any) => [u._id.toString(), u]),
    );
    const lastMsgMap = new Map<string, any>();
    for (const msg of lastMsgAgg) {
      lastMsgMap.set(msg.conversationId.toString(), msg);
    }

    // Assemble response
    const data = (conversations as any[]).map((convo) => {
      const otherParticipants = convo.participants
        .filter((p: any) => p.id.toString() !== userId)
        .map((p: any) => {
          const u = userInfoMap.get(p.id.toString()) as any;
          return {
            ...p,
            name: u?.name || 'Unknown',
            image: u?.profileImage || null,
          };
        });

      return {
        ...convo,
        participants: otherParticipants,
        lastMessage: lastMsgMap.get(convo._id.toString()) || null,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMessages(
    conversationId: string,
    userId: string,
    role: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const convoId = new Types.ObjectId(conversationId);

    const conversation = (await this.conversationModel
      .findById(convoId)
      .lean()) as any;
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some(
      (p: any) => p.id.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: convoId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.messageModel.countDocuments({ conversationId: convoId }),
    ]);

    return {
      data: messages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAll(
    userId: string,
    role: string,
    page: number = 1,
    limit: number = 20,
  ) {
    return this.getConversations(userId, role, page, limit);
  }
}

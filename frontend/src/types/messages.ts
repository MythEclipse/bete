export type { AIStatus, MessageRecord, PageResult } from "../api/client";

export interface MessageMetadataAttachment {
  name: string;
  url: string;
  size: number;
  contentType?: string | null;
}

export interface MessageMetadataEmbed {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  thumbnail?: string;
}

export interface MessageMetadataSticker {
  name: string;
  url: string;
}

export interface MessageMetadata {
  attachments?: MessageMetadataAttachment[];
  embeds?: MessageMetadataEmbed[];
  stickers?: MessageMetadataSticker[];
  reference?: { messageId?: string };
  channel?: { threadName?: string };
}

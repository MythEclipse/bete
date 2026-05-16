import type { MessageMetadata, MessageRecord } from "../../types/messages";

function parseMetadata(value: string | null): MessageMetadata {
  if (!value) return {};
  try {
    return JSON.parse(value) as MessageMetadata;
  } catch {
    return {};
  }
}

export function ImageGrid({ messages }: { messages: MessageRecord[] }) {
  const images = messages.flatMap((message) => {
    const metadata = parseMetadata(message.metadata);
    const attachments = metadata.attachments ?? [];
    const embeds = metadata.embeds ?? [];
    return [
      ...attachments
        .filter((attachment) => attachment.url && (attachment.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(attachment.name)))
        .map((attachment) => ({ url: attachment.url, title: attachment.name, message })),
      ...embeds
        .flatMap((embed) => [embed.image, embed.thumbnail].filter(Boolean).map((url) => ({ url: url as string, title: embed.title || "embed image", message }))),
    ];
  });

  if (images.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No images found.</div>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {images.map((image, index) => (
        <a key={`${image.url}-${index}`} href={image.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <img src={image.url} alt={image.title} className="aspect-video w-full object-cover transition-transform group-hover:scale-105" />
          <div className="p-3">
            <div className="truncate text-sm font-medium">{image.title}</div>
            <div className="truncate text-xs text-muted-foreground">{image.message.username}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChatMessage } from '../../types/chat';

interface Props {
  message: ChatMessage;
}

type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

function parseMultimodalContent(content: string): MultimodalPart[] | null {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((part) => part?.type === 'text' || part?.type === 'image_url')) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getDisplayText(text: string): string {
  return text.split('\n\n--- 附件文件内容 ---')[0].trim();
}

function UserContent({ content }: { content: string }) {
  const parts = parseMultimodalContent(content);

  if (!parts) {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }

  const text = parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => getDisplayText(part.text))
    .filter(Boolean)
    .join('\n\n');
  const images = parts.filter((part): part is { type: 'image_url'; image_url: { url: string } } => part.type === 'image_url');

  return (
    <div className="space-y-2">
      {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((part, index) => (
            <img
              key={index}
              src={part.image_url.url}
              alt="上传的图片"
              className="max-h-28 max-w-40 rounded-lg object-cover border border-white/30"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 flex-shrink-0 mr-2 text-2xl leading-8 text-center">
          🦊
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-fox-orange text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <UserContent content={message.content} />
        ) : (
          <div className="prose prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-fox-orange">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 flex-shrink-0 ml-2 text-sm leading-8 text-center bg-gray-300 rounded-full">
          U
        </div>
      )}
    </div>
  );
}

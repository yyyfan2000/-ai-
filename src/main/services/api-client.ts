interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  capabilities: { text: boolean; image: boolean; file: boolean };
}

/** OpenAI 兼容的多模态消息内容 */
type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
      | { type: 'file'; file: { filename: string; data: string } }
    >;

interface ChatMessage {
  role: string;
  content: MessageContent;
}

interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (code: string, message: string) => void;
}

export interface ChatRequestOptions {
  enableSearch?: boolean;
  searchResults?: string;
}

/**
 * 发送流式对话请求（OpenAI 兼容格式 + 多模态 + 联网搜索）
 */
export async function streamChat(
  model: ModelConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options: ChatRequestOptions = {}
): Promise<void> {
  const { baseUrl, apiKey, modelId } = model;
  const url = `${baseUrl}/v1/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  // 构建消息列表
  let finalMessages = [...messages];

  // 如果启用了联网搜索，将搜索结果注入到 system 消息中
  if (options.enableSearch && options.searchResults) {
    const searchContext = {
      role: 'system',
      content: `以下是当前网络搜索的结果，请基于这些信息回答用户问题。如果搜索结果不足以回答问题，请如实告知用户：\n\n${options.searchResults}`,
    } as ChatMessage;
    finalMessages = [searchContext, ...finalMessages];
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: finalMessages,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      callbacks.onError('auth_failed', 'API 认证失败，请检查 Key 是否正确');
      return;
    }
    if (response.status === 500 || response.status === 502 || response.status === 503) {
      callbacks.onError('service_unavailable', '服务暂时不可用，请稍后重试或切换模型');
      return;
    }
    if (!response.ok) {
      const errorBody = await response.text();
      callbacks.onError('unknown', `请求失败 (${response.status}): ${errorBody}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('unknown', '无法读取响应流');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) callbacks.onChunk(content);
        } catch { /* skip unparseable lines */ }
      }
    }

    callbacks.onDone();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      callbacks.onError('timeout', '请求超时，请检查网络连接');
    } else {
      callbacks.onError('unknown', `网络错误: ${err.message}`);
    }
  }
}

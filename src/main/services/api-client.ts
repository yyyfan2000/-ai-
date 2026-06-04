interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  capabilities: { text: boolean; image: boolean; file: boolean; search: boolean };
}

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
 * 获取厂商特定的联网搜索 extra_body
 */
function getSearchExtraBody(provider: string): Record<string, unknown> | null {
  switch (provider) {
    case 'deepseek':
      return { enable_search: true };
    case 'kimi':
      return { use_search: true };
    case 'zhipu':
      return { tools: [{ type: 'web_search' }] };
    default:
      return null;
  }
}

/**
 * 发送流式对话请求（OpenAI 兼容 + 多模态 + 厂商搜索参数）
 */
export async function streamChat(
  model: ModelConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options: ChatRequestOptions = {}
): Promise<void> {
  const { baseUrl, apiKey, modelId, provider, capabilities } = model;
  const url = `${baseUrl}/v1/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  // 构建消息列表 + 搜索上下文
  let finalMessages = [...messages];

  if (options.enableSearch && options.searchResults) {
    const searchCtx: ChatMessage = {
      role: 'system',
      content: `以下是与用户问题相关的网络搜索结果，请基于这些信息回答。如果搜索结果不足以回答问题，请如实告知：\n\n${options.searchResults}`,
    };
    finalMessages = [searchCtx, ...finalMessages];
  }

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model: modelId,
    messages: finalMessages,
    stream: true,
  };

  // 厂商特定的搜索参数（通过 extra_body 透传）
  if (options.enableSearch && capabilities.search) {
    const searchExtra = getSearchExtraBody(provider);
    if (searchExtra) {
      // DeepSeek 使用 extra_body，其他厂商可能需要不同方式
      // 对于 OpenAI 兼容 API，通过顶层 tools 或 extra_body 注入
      (requestBody as any).extra_body = {
        ...((requestBody as any).extra_body || {}),
        ...searchExtra,
      };
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      callbacks.onError('auth_failed', 'API 认证失败，请检查 Key 是否正确');
      return;
    }
    if (response.status === 400) {
      const errorBody = await response.text();
      let friendlyMsg = '请求参数错误';
      if (errorBody.includes('image')) {
        friendlyMsg = '图片格式不支持或文件过大，请压缩后重试（建议 5MB 以内）';
      } else if (errorBody.includes('file')) {
        friendlyMsg = '文件格式不支持，请尝试其他格式';
      } else if (errorBody.includes('search')) {
        friendlyMsg = '当前模型未开通联网搜索功能，请在设置中关闭';
      }
      callbacks.onError('unknown', friendlyMsg);
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
        } catch { /* skip */ }
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

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

export interface ListProviderModelsRequest {
  provider: string;
  apiKey: string;
  baseUrl: string;
}

export interface ListProviderModelsResult {
  models: string[];
  source: 'api' | 'fallback';
  error?: string;
}

const FALLBACK_MODELS: Record<string, string[]> = {
  qwen: [
    'qwen-plus',
    'qwen-max',
    'qwen-turbo',
    'qwen-long',
    'qwen-vl-plus',
    'qwen-vl-max',
  ],
};

/**
 * 获取 OpenAI 兼容的 chat/completions 地址。
 * 部分厂商的 baseUrl 已经包含版本路径，不能再追加 /v1。
 */
function buildChatUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (/\/(v1|v3|v4)$/i.test(normalized)) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
}

function buildModelsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return `${normalized}/models`;
}

function getFallbackModels(provider: string): string[] {
  return FALLBACK_MODELS[provider] || [];
}

export async function listProviderModels(
  request: ListProviderModelsRequest
): Promise<ListProviderModelsResult> {
  const fallback = getFallbackModels(request.provider);

  try {
    const response = await fetch(buildModelsUrl(request.baseUrl), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${request.apiKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`模型列表接口返回 ${response.status}`);
    }

    const body = await response.json() as {
      data?: Array<{ id?: string }>;
      models?: Array<string | { id?: string; name?: string }>;
    };
    const rawModels = body.data
      ? body.data.map((item) => item.id || '')
      : (body.models || []).map((item) => typeof item === 'string' ? item : item.id || item.name || '');
    const models = rawModels
      .filter((id): id is string => Boolean(id))
      .filter((id) => request.provider !== 'qwen' || id.startsWith('qwen'))
      .sort((a, b) => a.localeCompare(b));

    if (models.length > 0) {
      return { models, source: 'api' };
    }

    if (fallback.length > 0) {
      return { models: fallback, source: 'fallback', error: '模型列表接口没有返回可用模型' };
    }
    return { models: [], source: 'api' };
  } catch (err: any) {
    if (fallback.length > 0) {
      return { models: fallback, source: 'fallback', error: err.message };
    }
    return { models: [], source: 'fallback', error: err.message };
  }
}

/**
 * 少数厂商支持在 Chat Completions 顶层传联网工具。
 * 本应用始终会先做本地搜索并注入上下文，这里只做兼容增强。
 */
function getSearchRequestPatch(provider: string): Record<string, unknown> | null {
  if (provider === 'qwen') {
    return {
      enable_search: true,
      search_options: {
        forced_search: true,
        search_strategy: 'turbo',
      },
    };
  }
  if (provider === 'zhipu') {
    return { tools: [{ type: 'web_search', web_search: { enable: true } }] };
  }
  return null;
}

function messageHasImage(messages: ChatMessage[]): boolean {
  return messages.some((message) => Array.isArray(message.content) &&
    message.content.some((part) => part.type === 'image_url'));
}

function isQwenImageGenerationModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.startsWith('qwen-image') || lower.includes('image-edit');
}

function getChatModelId(model: ModelConfig, messages: ChatMessage[]): string {
  const lower = model.modelId.toLowerCase();
  if (model.provider === 'qwen' && isQwenImageGenerationModel(model.modelId)) {
    return messageHasImage(messages) ? 'qwen-vl-plus' : 'qwen-plus';
  }
  if (model.provider === 'qwen' && lower.includes('-realtime')) {
    return model.modelId.replace(/-realtime(?=-\d{4}-\d{2}-\d{2}$|$)/, '');
  }
  return model.modelId;
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
  const { baseUrl, apiKey, provider, capabilities } = model;
  const url = buildChatUrl(baseUrl);

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

  const requestModelId = getChatModelId(model, finalMessages);

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model: requestModelId,
    messages: finalMessages,
    stream: true,
  };

  // 厂商特定的原生搜索参数
  if (options.enableSearch) {
    const searchPatch = getSearchRequestPatch(provider);
    if (searchPatch) {
      Object.assign(requestBody, searchPatch);
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
    let receivedContent = false;

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
          if (receivedContent) {
            callbacks.onDone();
          } else {
            callbacks.onError('empty_response', '当前模型没有返回可显示的文本，请切换到文本/视觉聊天模型后重试');
          }
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content || delta?.text || parsed.output?.text;
          if (content) {
            receivedContent = true;
            callbacks.onChunk(content);
          }
        } catch { /* skip */ }
      }
    }

    if (receivedContent) {
      callbacks.onDone();
    } else {
      callbacks.onError('empty_response', '当前模型没有返回可显示的文本，请切换到文本/视觉聊天模型后重试');
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      callbacks.onError('timeout', '请求超时，请检查网络连接');
    } else {
      callbacks.onError('unknown', `网络错误: ${err.message}`);
    }
  }
}

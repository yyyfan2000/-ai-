/**
 * 联网搜索服务
 * 优先使用 DuckDuckGo，失败时返回空（静默降级）
 */

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function formatResults(query: string, results: string[]): string {
  return `以下是与"${query}"相关的网络搜索结果：\n\n${results.join('\n')}`;
}

export async function searchWeb(query: string): Promise<string> {
  try {
    // 方案1: DuckDuckGo HTML 搜索（更可靠）
    const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=cn-zh`;
    const htmlRes = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();

      // 提取搜索结果
      const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*result[^"]*"|<\/body>)/gi;
      const results: string[] = [];
      let match;

      while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
        const block = match[1] || '';
        const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<(?:a|span)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span)>/i);
        const title = titleMatch ? stripHtml(titleMatch[1]) : '';
        const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : '';
        if (title || snippet) {
          results.push(`- [${title}] ${snippet.slice(0, 200)}`);
        }
      }

      if (results.length > 0) {
        return formatResults(query, results);
      }
    }
  } catch {
    // DuckDuckGo 不可用，尝试备用方案
  }

  // 方案2: DuckDuckGo Lite
  try {
    const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const liteRes = await fetch(liteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (liteRes.ok) {
      const html = await liteRes.text();
      // Lite 版本结果格式
      const linkRegex = /<a[^>]*rel="nofollow"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*rel="nofollow"|<\/body>)/gi;
      const results: string[] = [];
      let match;

      while ((match = linkRegex.exec(html)) !== null && results.length < 5) {
        const title = stripHtml(match[1] || '');
        const snippet = stripHtml((match[2] || '').replace(/<a[\s\S]*$/i, ''));
        if (title) {
          results.push(`- ${title}${snippet ? ': ' + snippet.slice(0, 150) : ''}`);
        }
      }

      if (results.length > 0) {
        return formatResults(query, results);
      }
    }
  } catch {
    // 静默失败
  }

  return ''; // 搜索失败，让 AI 基于自身知识回答
}

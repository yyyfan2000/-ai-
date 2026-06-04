/**
 * 联网搜索服务
 * 使用 DuckDuckGo Instant Answer API（免费，无需 API Key）
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchWeb(query: string): Promise<string> {
  try {
    // 使用 DuckDuckGo Instant Answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'XiaoLing-Desktop-Pet/1.0' },
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json() as any;
    const parts: string[] = [];

    // 摘要答案
    if (data.AbstractText) {
      parts.push(`📖 ${data.AbstractText}\n来源: ${data.AbstractURL}`);
    }

    // 相关信息
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topics = data.RelatedTopics.filter((t: any) => t.Text).slice(0, 5);
      if (topics.length > 0) {
        parts.push(`\n🔗 相关信息:`);
        topics.forEach((t: any) => {
          const snippet = t.Text.length > 200 ? t.Text.slice(0, 200) + '...' : t.Text;
          parts.push(`- ${snippet}`);
        });
      }
    }

    if (parts.length === 0) {
      // 如果 DuckDuckGo 没结果，尝试用 HTML 搜索抓取
      const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const htmlRes = await fetch(htmlUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      });
      const html = await htmlRes.text();

      // 简易抓取结果
      const resultRegex = /<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*?>([^<]*)<\/a>/gi;
      const matches = Array.from(html.matchAll(resultRegex)).slice(0, 5);

      if (matches.length > 0) {
        parts.push(`🔗 "${query}" 的搜索结果:`);
        matches.forEach((m) => {
          const title = m[1]?.replace(/<[^>]+>/g, '').trim() || '';
          const snippet = m[2]?.replace(/<[^>]+>/g, '').trim() || '';
          if (title || snippet) {
            parts.push(`- ${title}: ${snippet.slice(0, 150)}`);
          }
        });
      }
    }

    return parts.join('\n');
  } catch {
    return ''; // 搜索失败时静默处理，让 AI 正常回复
  }
}

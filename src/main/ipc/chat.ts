import { ipcMain, BrowserWindow } from 'electron';
import { streamChat } from '../services/api-client';
import { getModels, getDefaultModel } from '../services/store';
import { searchWeb } from '../services/search';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageContent = string | any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ChatMessage { role: string; content: any; }

export function registerChatIpc(): void {
  ipcMain.handle('chat:get-models', () => getModels());
  ipcMain.handle('chat:get-default-model', () => getDefaultModel());

  ipcMain.on('chat:send-message', async (event, args: {
    modelId: string;
    messages: ChatMessage[];
    enableSearch?: boolean;
  }) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const models = getModels();
    const model = models.find(m => m.id === args.modelId);

    if (!model) {
      senderWindow?.webContents.send('chat:error', {
        code: 'no_model', message: '未找到指定模型，请检查设置',
      });
      return;
    }

    if (!model.apiKey) {
      senderWindow?.webContents.send('chat:error', {
        code: 'no_api_key', message: '请先在设置中配置 API Key',
      });
      return;
    }

    // 联网搜索
    let searchResults: string | undefined;
    if (args.enableSearch) {
      // 从最后一条用户消息中提取查询关键词
      const lastUserMsg = [...args.messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        const query = typeof lastUserMsg.content === 'string'
          ? lastUserMsg.content
          : (lastUserMsg.content as any[]).find((p: any) => p.type === 'text')?.text || '';
        if (query) {
          senderWindow?.webContents.send('chat:search-status', 'searching');
          searchResults = await searchWeb(query.slice(0, 200));
          senderWindow?.webContents.send('chat:search-status', searchResults ? 'done' : 'empty');
        }
      }
    }

    streamChat(
      model,
      args.messages,
      {
        onChunk: (text) => senderWindow?.webContents.send('chat:stream-chunk', text),
        onDone: () => senderWindow?.webContents.send('chat:stream-done'),
        onError: (code, message) => senderWindow?.webContents.send('chat:stream-error', { code, message }),
      },
      { enableSearch: args.enableSearch, searchResults }
    );
  });
}

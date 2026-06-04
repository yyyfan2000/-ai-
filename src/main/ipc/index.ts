import { ipcMain, Menu, dialog } from 'electron';
import { registerChatIpc } from './chat';
import { registerSettingsIpc } from './settings';
import { createChatWindow } from '../windows/chat';
import { createSettingsWindow } from '../windows/settings';
import { getPetWindow, closePetWindow } from '../windows/pet';

export function registerAllIpc(): void {
  registerChatIpc();
  registerSettingsIpc();

  // 窗口控制
  ipcMain.on('window:open-chat', () => createChatWindow());
  ipcMain.on('window:open-settings', () => createSettingsWindow());

  // 宠物右键菜单
  ipcMain.on('pet:context-menu', () => {
    const petWin = getPetWindow();
    if (!petWin) return;

    const menu = Menu.buildFromTemplate([
      {
        label: '⚙️ 设置',
        click: () => createSettingsWindow(),
      },
      { type: 'separator' },
      {
        label: '🚪 退出',
        click: () => {
          const choice = dialog.showMessageBoxSync(petWin!, {
            type: 'question',
            buttons: ['取消', '确定退出'],
            defaultId: 0,
            title: '退出小灵',
            message: '确定要退出小灵吗？',
            detail: '你可以随时从菜单栏的 🦊 图标重新打开。',
          });
          if (choice === 1) closePetWindow();
        },
      },
    ]);
    menu.popup();
  });

  // 宠物窗口拖拽
  ipcMain.on('window:move-pet', (_event, { dx, dy }: { dx: number; dy: number }) => {
    const petWin = getPetWindow();
    if (petWin) {
      const [x, y] = petWin.getPosition();
      petWin.setPosition(x + dx, y + dy);
    }
  });

  // 宠物状态同步（Renderer → Main → PetWindow Renderer）
  ipcMain.on('pet:set-state', (_event, state: string) => {
    const petWin = getPetWindow();
    petWin?.webContents.send('pet:state-changed', state);
  });
}

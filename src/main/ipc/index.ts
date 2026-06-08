import { ipcMain, Menu, dialog } from 'electron';
import { registerChatIpc } from './chat';
import { registerSettingsIpc } from './settings';
import { showChatWindow } from '../windows/chat';
import { createSettingsWindow } from '../windows/settings';
import { getPetWindow } from '../windows/pet';
import { closeAllWindowsToDock } from '../tray';

export function registerAllIpc(): void {
  registerChatIpc();
  registerSettingsIpc();

  // 窗口控制
  ipcMain.on('window:open-chat', () => showChatWindow());
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
        label: '🚪 退出到 Dock',
        click: () => {
          const choice = dialog.showMessageBoxSync(petWin!, {
            type: 'question',
            buttons: ['取消', '退出到 Dock'],
            defaultId: 0,
            title: '退出小灵',
            message: '确定要退出小灵吗？',
            detail: '这会关闭小狐狸、对话窗口和设置窗口，但保留 Dock 入口。可从 Dock 点击小狐狸图标重新显示小灵。',
          });
          if (choice === 1) closeAllWindowsToDock();
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

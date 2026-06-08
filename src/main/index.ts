import { app } from 'electron';
import { createPetWindow } from './windows/pet';
import { registerAllIpc } from './ipc';
import { createFoxDockIcon } from './services/app-icon';

app.setName('小灵');

app.whenReady().then(() => {
  const foxIcon = createFoxDockIcon();

  app.setAboutPanelOptions({
    applicationName: '小灵',
  });

  if (process.platform === 'darwin') {
    app.dock?.setIcon(foxIcon);
    app.dock?.show();
  }

  registerAllIpc();
  createPetWindow();

  app.on('activate', () => {
    createPetWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 不退出，保留 Dock 入口
});

app.on('before-quit', () => {
  // 清理工作
});

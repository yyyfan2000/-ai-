import { app } from 'electron';
import { closeChatWindow } from './windows/chat';
import { closePetWindow } from './windows/pet';
import { closeSettingsWindow } from './windows/settings';
import { createFoxDockIcon } from './services/app-icon';

export function closeAllWindowsToDock(): void {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(createFoxDockIcon());
    app.dock?.show();
  }
  closeChatWindow();
  closeSettingsWindow();
  closePetWindow();
}

export function quitAppCompletely(): void {
  closeChatWindow();
  closeSettingsWindow();
  closePetWindow();
  app.quit();
}

import { Tray, Menu, nativeImage, app, NativeImage } from 'electron';
import { showPetWindow, closePetWindow } from './windows/pet';
import { createSettingsWindow } from './windows/settings';

let tray: Tray | null = null;

function createTrayIcon(): NativeImage {
  const size = 32; // 用 32x32 适配 Retina 屏幕
  const buffer = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = size / 2 - 4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist < outerR) {
        // 狐狸橙色圆形主体
        buffer[i] = 0xFF;     // R
        buffer[i + 1] = 0x88; // G
        buffer[i + 2] = 0x2E; // B
        buffer[i + 3] = 0xFF; // A
      }

      if (dist < innerR * 0.5 && x < cx && y > cy * 1.1) {
        // 白色鼻头区域（左下方小圆）
        buffer[i] = 0xFF;
        buffer[i + 1] = 0xFF;
        buffer[i + 2] = 0xFF;
        buffer[i + 3] = 0xFF;
      }
    }
  }

  // 画两个尖耳朵
  for (let y = 0; y < outerR; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const distLeft = Math.sqrt((x - cx + 5) ** 2 + (y - cy + outerR) ** 2);
      const distRight = Math.sqrt((x - cx - 5) ** 2 + (y - cy + outerR) ** 2);

      if (distLeft < 6 || distRight < 6) {
        buffer[i] = 0xFF;
        buffer[i + 1] = 0x88;
        buffer[i + 2] = 0x2E;
        buffer[i + 3] = 0xFF;
      }
    }
  }

  const img = nativeImage.createFromBuffer(buffer, { width: size, height: size });
  return img.resize({ width: 18, height: 18 }); // macOS 菜单栏标准大小
}

export function createTray(): Tray {
  const icon = createTrayIcon();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示小灵', click: () => showPetWindow() },
    { label: '设置', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: '退出', click: () => { closePetWindow(); app.quit(); } },
  ]);

  tray.setToolTip('小灵 · AI助手');
  tray.setContextMenu(contextMenu);
  return tray;
}

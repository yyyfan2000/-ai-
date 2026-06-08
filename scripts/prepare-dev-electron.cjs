const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const distDir = path.join(electronDir, 'dist');
const sourceApp = path.join(distDir, 'Electron.app');
const devApp = path.join(distDir, '小灵.app');
const sourceExecutable = path.join(sourceApp, 'Contents', 'MacOS', 'Electron');
const devExecutable = path.join(sourceApp, 'Contents', 'MacOS', '小灵');
const pathFile = path.join(electronDir, 'path.txt');
const iconSource = path.join(root, 'resources', 'icon.icns');
const iconTarget = path.join(sourceApp, 'Contents', 'Resources', 'xiaoling.icns');
const plist = path.join(sourceApp, 'Contents', 'Info.plist');

if (!fs.existsSync(sourceApp)) {
  throw new Error(`Electron app not found: ${sourceApp}`);
}

if (fs.existsSync(devApp) && !fs.lstatSync(devApp).isSymbolicLink()) {
  fs.rmSync(devApp, { recursive: true, force: true });
}

if (!fs.existsSync(devApp)) {
  fs.symlinkSync('Electron.app', devApp, 'dir');
}

fs.copyFileSync(iconSource, iconTarget);

if (!fs.existsSync(devExecutable)) {
  fs.copyFileSync(sourceExecutable, devExecutable);
  fs.chmodSync(devExecutable, 0o755);
}

const setPlist = (key, value) => {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist]);
};

setPlist('CFBundleName', '小灵');
setPlist('CFBundleDisplayName', '小灵');
setPlist('CFBundleExecutable', '小灵');
setPlist('CFBundleIconFile', 'xiaoling.icns');
setPlist('CFBundleIdentifier', 'com.xiaoling.desktop.dev');

fs.writeFileSync(pathFile, '小灵.app/Contents/MacOS/小灵');

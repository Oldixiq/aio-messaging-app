import { join } from 'node:path';
import { Menu, nativeImage, Tray } from 'electron';

export interface TrayController {
  update(opts: { muted: boolean; unread: number }): void;
  destroy(): void;
}

export function createTray(handlers: { show: () => void; toggleMute: () => void; quit: () => void }): TrayController {
  const image = nativeImage.createFromPath(join(__dirname, '../../resources/tray.png'));
  image.addRepresentation({ scaleFactor: 2, buffer: nativeImage.createFromPath(join(__dirname, '../../resources/tray@2x.png')).toPNG() });
  const tray = new Tray(image);
  tray.setToolTip('AIO Messenger');
  tray.on('click', handlers.show);

  let last = '';
  const update = ({ muted, unread }: { muted: boolean; unread: number }) => {
    const key = `${muted}|${unread}`;
    if (key === last) return;
    last = key;
    tray.setToolTip(unread > 0 ? `AIO Messenger – ${unread} unread` : 'AIO Messenger');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open AIO Messenger', click: handlers.show },
        { type: 'separator' },
        { label: 'Mute notifications', type: 'checkbox', checked: muted, click: handlers.toggleMute },
        { type: 'separator' },
        { label: 'Quit', click: handlers.quit },
      ]),
    );
  };
  update({ muted: false, unread: 0 });

  return { update, destroy: () => tray.destroy() };
}

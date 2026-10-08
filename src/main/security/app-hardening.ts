import { app } from 'electron';
import { createLogger } from '../logger';

const log = createLogger('security');

/** Process-wide rules applied to every WebContents the app ever creates. */
export function hardenApp(): void {
  app.on('web-contents-created', (_event, contents) => {
    // We never use <webview>; refuse any attempt to attach one.
    contents.on('will-attach-webview', (event) => {
      log.warn('blocked <webview> attachment');
      event.preventDefault();
    });
  });
}

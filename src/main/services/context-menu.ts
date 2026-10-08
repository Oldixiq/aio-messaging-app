import { clipboard, Menu, type MenuItemConstructorOptions, type WebContents } from 'electron';
import { openExternalSafely } from './navigation-policy';

/** Native right-click menu for service pages (Electron has none by default). */
export function attachContextMenu(webContents: WebContents, opts: { isDev: boolean; onReload: () => void }): void {
  webContents.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = [];

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: suggestion, click: () => webContents.replaceMisspelling(suggestion) });
      }
      items.push({
        label: 'Add to dictionary',
        click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      items.push({ type: 'separator' });
    }

    if (params.linkURL) {
      items.push(
        { label: 'Open link in browser', click: () => openExternalSafely(params.linkURL) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }

    if (params.mediaType === 'image' && params.srcURL) {
      items.push(
        { label: 'Copy image', click: () => webContents.copyImageAt(params.x, params.y) },
        { label: 'Open image in browser', click: () => openExternalSafely(params.srcURL) },
        { type: 'separator' },
      );
    }

    const { editFlags } = params;
    if (params.isEditable) {
      items.push(
        { role: 'undo', enabled: editFlags.canUndo },
        { role: 'redo', enabled: editFlags.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: editFlags.canCut },
        { role: 'copy', enabled: editFlags.canCopy },
        { role: 'paste', enabled: editFlags.canPaste },
        { role: 'pasteAndMatchStyle', enabled: editFlags.canPaste },
        { role: 'selectAll', enabled: editFlags.canSelectAll },
        { type: 'separator' },
      );
    } else if (params.selectionText) {
      items.push({ role: 'copy' }, { type: 'separator' });
    }

    const history = webContents.navigationHistory;
    items.push(
      { label: 'Back', enabled: history.canGoBack(), click: () => history.goBack() },
      { label: 'Forward', enabled: history.canGoForward(), click: () => history.goForward() },
      { label: 'Reload', click: opts.onReload },
    );

    if (opts.isDev) {
      items.push({ type: 'separator' }, { label: 'Inspect element', click: () => webContents.inspectElement(params.x, params.y) });
    }

    Menu.buildFromTemplate(items).popup();
  });
}

import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerFilesIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('files:pick', async (_e, opts?: { multi?: boolean; images?: boolean }) => {
    const win = getWindow()
    if (!win) return [] as string[]
    const filters = opts?.images
      ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
      : []
    const result = await dialog.showOpenDialog(win, {
      properties: opts?.multi ? ['openFile', 'multiSelections'] : ['openFile'],
      filters,
      title: 'Choose a file'
    })
    if (result.canceled) return [] as string[]
    return result.filePaths
  })
}

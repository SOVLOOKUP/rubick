import { app, BrowserWindow, protocol } from 'electron'
import '../renderer/store'
import init from './common/common';
import {autoUpdate} from './common/autoUpdate';
import createTray from './tray';
const {capture} = require("./browsers")();
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}
// to fix https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = false;
let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {
  /**
   * Initial window options
   */
  capture.useCapture()
  mainWindow = new BrowserWindow({
    height: 60,
    useContentSize: true,
    width: 800,
    frame: false,
    title: '拉比克',
    webPreferences: {
      webSecurity: false,
      enableRemoteModule: true,
      backgroundThrottling: false,
      webviewTag: true,
      contextIsolation: false,
      nodeIntegration: true // 在网页中集成Node
    }
  })

  mainWindow.loadURL(winURL)

  mainWindow.on('closed', () => {
    mainWindow = null
  });
  protocol.interceptFileProtocol('image', (req, callback) => {
    const url = req.url.substr(8);
    callback(decodeURI(url));
  }, (error) => {
    if (error) {
      console.error('Failed to register protocol');
    }
  });
  init(mainWindow);
}

app.on('ready', () => {
  createWindow()
  createTray(mainWindow);
  autoUpdate();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */

const {getData, getlocalDataFile, saveData} = require("./utils");
const axios = require('axios');
const marked = require("marked");
const rendererMD = new marked.Renderer();
const path = require('path');
const os = require('os');

const appPath = path.join(getlocalDataFile());
const dbPath = path.join(appPath, './db.json');

let filePath = '';
function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    if(pair[0] == variable){return pair[1];}
  }
  return(false);
}

if (location.href.indexOf('targetFile') > -1) {
  filePath = decodeURIComponent(getQueryVariable('targetFile'));
} else {
  filePath = process.platform === 'win32' ? location.pathname.replace('/', '') : location.pathname.replace('file://', '');
}
const {ipcRenderer, nativeImage, clipboard, remote, shell} = require('electron');

const currentWindow = remote.getCurrentWindow();
const winId = currentWindow.id;
const BrowserWindow = remote.BrowserWindow;

function convertImgToBase64(url, callback, outputFormat){
  var canvas = document.createElement('CANVAS'),
    ctx = canvas.getContext('2d'),
    img = new Image;
  img.crossOrigin = 'Anonymous';
  img.onload = function(){
    canvas.height = img.height;
    canvas.width = img.width;
    ctx.drawImage(img,0,0);
    var dataURL = canvas.toDataURL(outputFormat || 'image/png');
    callback.call(this, dataURL);
    canvas = null;
  };
  img.src = url;
}

window.rubick = {
  // 事件
  onPluginEnter(cb) {
    ipcRenderer.on('onPluginEnter', (e, message) => {
      const feature = message.detail;
      cb({...feature, type: message.cmd.type ? message.cmd.type : 'text', payload: message.payload})
    })
  },
  onPluginReady(cb) {
    ipcRenderer.once('onPluginReady', (e, message) => {
      const feature = message.detail
      cb({...feature, type: message.cmd.type ? message.cmd.type : 'text', payload: message.payload})
    })
  },
  onPluginOut(cb) {
    ipcRenderer.once('onPluginOut', (e, message) => {
      const feature = JSON.parse(message.detail)
      cb({...feature, type: 'text'})
    })
  },

  // 窗口交互
  hideMainWindow() {
    ipcRenderer.send('msg-trigger', {
      type: 'hideMainWindow',
    });
  },
  showMainWindow() {
    ipcRenderer.send('msg-trigger', {
      type: 'showMainWindow',
    });
  },
  setExpendHeight(height) {
    ipcRenderer.send('msg-trigger', {
      type: 'setExpendHeight',
      height,
      winId
    });
  },
  setSubInput(onChange, placeHolder, isFocus) {
    ipcRenderer.sendToHost('setSubInput', {
      placeHolder, isFocus
    });
    ipcRenderer.on(`msg-back-setSubInput`, (e, result) => {
      onChange({text: result});
    });
  },

  removeSubInput() {
    ipcRenderer.sendToHost('removeSubInput');
  },

  setSubInputValue(text) {
    ipcRenderer.sendToHost('setSubInputValue', {
      text
    });
  },

  getPath(name) {
    return remote.app.getPath(name);
  },

  showNotification(body, clickFeatureCode) {
    const myNotification = new Notification('Rubick 通知', {
      body
    });
    return myNotification;
    // todo 实现 clickFeatureCode
  },
  showOpenDialog(options) {
    ipcRenderer.send('msg-trigger', {
      type: 'showOpenDialog',
      options: {...options},
    });
    return new Promise((resolve, reject) => {
      ipcRenderer.once(`msg-back-showOpenDialog`, (e, result) => {
        result ? resolve(result) : reject();
      });
    })
  },

  copyImage(img) {
    convertImgToBase64(img,function(base64Image) {
      const image = nativeImage.createFromDataURL(base64Image)
      clipboard.writeImage(image)
    })
  },
  copyText(text) {
    clipboard.writeText(text);
  },
  db: {
    put(data) {
      data._rev = '';
      let dbData = getData(dbPath) || [];
      let target = [];
      dbData.some((d, i) => {
        if (d._id === data._id) {
          target = [d, i]
          return true;
        }
        return false;
      });

      // 更新
      if (target[0]) {
        dbData[target[1]] = data;
      } else {
        dbData.push(data);
      }
      saveData(dbPath, dbData);
      return {
        id: data._id,
        ok: true,
        rev: '',
      }
    },
    get(key) {
      const dbData = getData(dbPath) || [];
      return dbData.find(d => d._id === key) || '';
    },
    remove(key) {
      key = typeof key === 'object' ? key._id : key;
      let dbData = getData(dbPath);
      let find = false;
      dbData.some((d, i) => {
        if (d._id === key) {
          dbData.splice(i, 1);
          find = true;
          return true;
        }
        return false;
      });
      if (find) {
        saveData(dbPath, dbData);
        return {
          id: key,
          ok: true,
          rev: '',
        }
      } else {
        return {
          id: key,
          ok: false,
          rev: '',
        }
      }
    },
    bulkDocs(docs) {
      const dbData = getData(dbPath);
      dbData.forEach((d, i) => {
        const result = docs.find(data => data._id === d._id);
        if (result) {
          dbData[i] = result;
        }
      });
      saveData(dbPath, dbData);
      return docs.map(d => ({
        id: d._id,
        success: true,
        rev: '',
      }))
    },
    allDocs(key) {
      const dbData = getData(dbPath);
      if (!key) {
        return dbData;
      }
      if (typeof key === 'string') {
        return dbData.filter(d => d._id.indexOf(key) >= 0);
      }
      if (Array.isArray(key)) {
        return dbData.filter(d => key.indexOf(d._id) >= 0);
      }
      return [];
    }
  },
  isDarkColors() {
    return false;
  },
  getFeatures() {
    ipcRenderer.sendToHost('getFeatures');
    return new Promise(resolve => {
      ipcRenderer.on(`msg-back-getFeatures`, (e, result) => {
        resolve(result);
      });
    });
  },
  setFeature(feature) {
    ipcRenderer.sendToHost('setFeature', {feature});
  },

  removeFeature(code) {
    ipcRenderer.sendToHost('removeFeature', {code});
  },
  // 系统
  shellOpenExternal(url) {
    shell.openExternal(url);
  },

  isMacOs() {
    return os.type() === 'Darwin';
  },

  isWindows() {
    return os.type() === 'Windows_NT';
  },

  shellOpenPath(path) {
    shell.openPath(path)
  },

  request(config = {}) {
    return axios.create({
      timeout: 10000,
      withCredentials: true,
      ...config,
    });
  }
}
const preloadPath = getQueryVariable('preloadPath') || './preload.js';

require(path.join(filePath, '../', preloadPath));
window.exports && ipcRenderer.sendToHost('templateConfig', {config: JSON.parse(JSON.stringify(window.exports))});
window.ipcRenderer = ipcRenderer;

const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const robot = require("kbm-robot");
const { mouseMove } = require('kbm-robot')
const ipcMain = electron.ipcMain
robot.startJar();
var robotjs = require("robotjs");


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

let lastKey;

function createWindow() {
  ipcMain.on('send-key', (_, key) => {
    if (key !== lastKey && lastKey) {
      robot.release(lastKey).press(key).go(() => {
        lastKey = key;
      });
    } else if (!lastKey) {
      robot.press(key).go(() => {
        lastKey = key;
      });
    }
    if (key === '') {
      robot.release(lastKey).go(() => {
        lastKey = false;
      });
    }

  })

  let lastMouse;
  ipcMain.on('send-mouse', (_, mouse) => {
    if (mouse !== lastMouse && lastMouse) {
      robot.mouseRelease(lastMouse).mousePress(mouse).go(() => {
        lastMouse = mouse;
      });
    } else if (!lastMouse) {
      robot.mousePress(mouse).go(() => {
        lastMouse = mouse;
      });
    }
    if (mouse === '') {
      robot.mouseRelease(lastMouse).go(() => {
        lastMouse = false;
      });
    }

  })

  ipcMain.on('send-mouse-move', (_, mouseMove) => {
    if (mouseMove.x || mouseMove.y) {
      const currentMousePos = robotjs.getMousePos();
      robot.mouseMove(currentMousePos.x + mouseMove.x, currentMousePos.y + mouseMove.y)
    }
  })

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800, height: 600, webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))


  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    robot.stopJar()
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

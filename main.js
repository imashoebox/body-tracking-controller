// To control application life, pass data between renderer and main, and create native browser window
const { app, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const robot = require("kbm-robot");
const { getMousePos } = require("robotjs");

// Start the kbm-robot java process
robot.startJar();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  let lastKey;
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
  });

  let lastMouseButton;
  ipcMain.on('send-mouse', (_, mouseButton) => {
    if (mouseButton !== lastMouseButton && lastMouseButton) {
      robot.mouseRelease(lastMouseButton).mousePress(mouseButton).go(() => {
        lastMouseButton = mouseButton;
      });
    } else if (!lastMouseButton) {
      robot.mousePress(mouseButton).go(() => {
        lastMouseButton = mouseButton;
      });
    }
    if (mouseButton === '') {
      robot.mouseRelease(lastMouseButton).go(() => {
        lastMouseButton = false;
      });
    }
  });

  ipcMain.on('send-mouse-move', (_, mouseMove) => {
    if (mouseMove.x || mouseMove.y) {
      const currentMousePos = getMousePos();
      robot.mouseMove(currentMousePos.x + mouseMove.x, currentMousePos.y + mouseMove.y);
    }
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: __dirname + '/assets/body-tracker.png',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
  }));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    robot.stopJar();
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

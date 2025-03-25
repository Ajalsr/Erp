
const { app, BrowserWindow } = require('electron/main')
const path = require('node:path')
//const electronReload = require('electron-reload');

function createWindow () {

    //electronReload(path.join(__dirname, './'));
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  //win.loadFile('index.html')
  win.loadURL('http://localhost:5173');
  //mainWindow.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit()
//   }
//})
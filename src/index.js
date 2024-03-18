const { ipcMain, app, BrowserWindow, Menu } = require('electron');
const fs = require('fs/promises');
const path = require('node:path');
const { highlight, tokenize, registerLanguage } = require('./code-highlighting');

let mainWindow = null;

let plugins = [];

//Menu.setApplicationMenu(null);

app.whenReady().then(() =>
{

    mainWindow = createWindow({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.maximize();
    mainWindow
        .loadFile(path.join(__dirname, 'index.html'))
        .then(_ => mainWindow.webContents.openDevTools())
        .catch(console.error);
    registerLanguage('grammar_js', 'grammar_html', 'grammar_json', 'grammar_md')
        .then(_ => console.log('Loaded grammar files'))
        .catch(error => console.error('Failed to load grammar files', error));
})

app
    .on('activate', _ =>
    {
        if ( BrowserWindow.getAllWindows().length === 0 )
            createWindow()
    })
    .on('window-all-closed', _ => app.quit())


/**
 *
 * @param {BrowserWindowConstructorOptions} args
 * @returns {Electron.CrossProcessExports.BrowserWindow}
 */
function createWindow(args = {})
{
    return new BrowserWindow({
        transparent: true,
        titleText: 'File Editor',
        titleBarOverlay: false,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        width: args?.width || 900,
        height: args?.height || 700,
        webPreferences: {
            nodeIntegration: args?.webPreferences?.nodeIntegration || true,
            contextIsolation: args?.webPreferences?.contextIsolation || true,
            nodeIntegrationInWorker: true,
            preload: path.join(__dirname, 'preload.js')
        },
        ...args
    })
}

ipcMain.handle('list-files-in-dir', (_, directoryPath) =>
{
    return fs.readdir(directoryPath = path.resolve(directoryPath), { withFileTypes: true })
        .then(files =>
        {
            return files.map(dirent =>
            {
                return {
                    name: dirent['name'],
                    absolutePath: path.join(directoryPath, dirent.name),
                    path: dirent['path'],
                    isDir: dirent.isDirectory(),
                    isFile: dirent.isFile(),
                    isSymLink: dirent.isSymbolicLink()
                };
            })
                .sort((a, b) => a.name.localeCompare(b.name));
        });
});

ipcMain.handle('read-file-data', (_, absolutePath, fromResources = false) =>
{
    if (fromResources)
        absolutePath = path.join(__dirname, 'resources', absolutePath);
    return fs.readFile(absolutePath, 'utf-8');
});

ipcMain.handle('file-exists', (event, absolutePath, fromResources = false) =>
{
    if (fromResources)
        absolutePath = path.join(__dirname, 'resources', absolutePath);
    return fs.access(absolutePath, fs.constants.F_OK);
})

ipcMain.handle('highlight-text', (_, content, format) => {
    return highlight(content, format);
});

ipcMain.handle('load-grammar', (_, grammarFile) =>
    registerLanguage(grammarFile))


/**
 * Function for loading external plugins into the application.
 */
function loadPlugins()
{
    console.time('plugin-file-loading');
    fs
        .readFile('/Users/lucawarm/Jetbrains/WebStorm/Personal IDE/plugins.json', 'utf-8')
        .then(content => JSON.parse(content))
        .then(json =>
        {
            if ( !Array.isArray(json) )
                throw new SyntaxError("Plugins file is in incorrect format.");

            plugins.push(
                ...json
                    .filter(entry =>
                        entry.hasOwnProperty('name') && entry.hasOwnProperty('sources')
                    )
                    .map(plugin =>
                    {
                        return {
                            name: plugin['name'],
                            sources: plugin['sources']
                        };
                    }));
            console.timeEnd('plugin-file-loading');
            console.log(`${plugins.length} plugin(s) loaded.`);

        })
        .catch(error => console.log("Failed to load plugins file", error));
}
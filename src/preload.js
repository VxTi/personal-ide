const { contextBridge, ipcRenderer } = require('electron');

let loadedGrammars = [];

const __fsDefs = {

    /**
     * @param {string} path The path to the directory to list
     * @returns {Promise<>}
     */
    listDir: async (path) =>
        ipcRenderer.invoke('list-files-in-dir', path),

    /**
     * @param {string} fileAbsolutePath The absolute path to the file to read
     * @returns {Promise<string>} The file's contents
     */
    readFile: async (fileAbsolutePath) =>
        ipcRenderer.invoke('read-file-data', fileAbsolutePath),

    getResource: async (resourcePath) =>
        ipcRenderer.invoke('read-file-data', resourcePath, true),

    /**
     * @param {string} fileAbsolutePath The absolute path to the file to check existence for.
     * @param {boolean} resource Whether the file is a resource or not.
     */
    fileExists: async (fileAbsolutePath, resource = false) =>
        ipcRenderer.invoke('file-exists', fileAbsolutePath, resource),

    files: {
        types: [
            {
                name: 'JS Files',
                extensions: [ 'js', 'jsx', 'cts', 'mjs' ],
                imgSrc: './resources/file_icons/ext-js.png'
            },
            {
                name: 'CSS Files',
                extensions: [ 'css', 'scss', 'sass', 'less' ],
                imgSrc: './resources/file_icons/css_icon.png'
            },
            {
                name: 'HTML Files',
                extensions: [ 'html', 'htm', 'xhtml' ],
                imgSrc: './resources/file_icons/ext-html.png'
            },
            {
                name: 'JSON Files',
                extensions: [ 'json' ],
                imgSrc: './resources/file_icons/ext-json.png'
            },
            {
                name: 'Markdown Files',
                extensions: [ 'md', 'markdown' ],
                imgSrc: './resources/file_icons/ext-md.png'
            },
            {
                name: 'Compressed Files',
                extensions: [ 'zip', 'tar', 'gz', '7z' ],
                imgSrc: './resources/file_icons/file_compressed_icon.png'
            },
            {
                name: 'Image Files',
                extensions: [ 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp' ],
                imgSrc: './resources/file_icons/ext-img.png'
            }
        ],
        getThumbnail: (fileExtension) =>
        {
            if ( fileExtension === 'directory' )
                return './resources/file_icons/ext-folder.png';

            return __fsDefs.files.types
                    .find(entry => entry.extensions.includes(fileExtension))?.imgSrc ??
                './resources/file_icons/ext-generic.png';
        }
    }
};

contextBridge.exposeInMainWorld('fs', __fsDefs);

contextBridge.exposeInMainWorld('grammar', {
    /**
     * Method for loading file grammar from the grammar folder.
     * @param fileName
     * @returns {Promise<unknown>}
     */
    load: async (fileName) =>
    {
        return new Promise(async (resolve, reject) =>
        {
            __fsDefs.fileExists('/grammar/' + fileName + '.json', true)
                .then(_ =>
                {
                    __fsDefs.getResource('/grammar/' + fileName + '.json')
                        .then(content => JSON.parse(content))
                        .then(json =>
                        {
                            loadedGrammars.push({ name: fileName, content: json });
                            resolve(json);
                        })
                        .catch(reject);
                })
                .catch(_ => reject(new Error("File does not exist.")));
        });
    },
    format: (content, fileType) =>
        ipcRenderer.invoke('highlight-text', content, fileType)
})
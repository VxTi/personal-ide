class AbstractFile {
    constructor(name, path, isFile = false, isDir = false, isSymLink = false) {
        this.name = name;
        this.path = path;
        this.absolutePath = path + '/' + name;
        this.isFile = isFile;
        this.isDir = isDir;
        this.isSymLink = isSymLink;
        this._hidden = name.startsWith('.');
    }

    get hidden() {
        return this._hidden;
    }
}

// Object containing all file hierarchy functions.
window.FileHierarchy = {

    fileCache: {},
    /**
     * @param {AbstractFile[]} files The paths to the files to display.
     * @param {HTMLElement} container The container to load the file hierarchy into.
     * @param {number} indentation The indentation level of the file hierarchy.
     */
    loadFiles: function(files, container, indentation= 0)
    {
        let isFileOpen = (filePath) => localStorage['openFiles']?.split(LOCAL_STORAGE_OBJ_SEPARATOR).includes(filePath) || false;

        // Iterate over all files
        for ( let file of files )
        {
            // If hidden files shouldn't be shown, continue iteration.
            if ( !__showHidden && file.hidden )
                continue;

            // Create new hierarchy element
            let createdElement = FileHierarchy.createElement(file, indentation);

            // Add 'open-directory' event listener to the file hierarchy item.
            createdElement.addEventListener('click', _ =>
            {
                document.querySelectorAll('.file-hierarchy-element[selected]')
                    .forEach(element => element.removeAttribute('selected'));
                createdElement.setAttribute('selected', '');

                if ( !createdElement.hasAttribute('directory') )
                {
                    openFile(file['absolutePath'], window['currentActiveEditor']);
                    return;
                }

                // If the file element is expanded, collapse it.
                if ( createdElement.getAttribute('expanded') === 'true' )
                {
                    FileHierarchy.closeElement(file['absolutePath'])
                        .then(_ =>
                        {
                            // Remove file open status from local storage object.
                            localStorage['openFiles'] = localStorage['openFiles']
                                .split(LOCAL_STORAGE_OBJ_SEPARATOR)
                                .filter(path => path !== file['absolutePath'])
                                .join(LOCAL_STORAGE_OBJ_SEPARATOR);
                        });
                }
                else
                {
                    FileHierarchy.openElement(file['absolutePath'], indentation + 1)
                        .then(_ =>
                        {
                            // Add file open status to local storage object.
                            localStorage['openFiles'] = localStorage['openFiles']
                                ? localStorage['openFiles'] + LOCAL_STORAGE_OBJ_SEPARATOR + file['absolutePath']
                                : file['absolutePath'];
                        })
                        .catch(_ => createdElement.setAttribute('expanded', 'false'));
                }
            })
            container.appendChild(createdElement);

            // If the file is contained in the 'open files' local storage object,
            // we expand the file and its contents.
            if ( isFileOpen(file['absolutePath']) )
            {
                createdElement.setAttribute('expanded', 'true');
                let nextContainer = FileHierarchy.createContainer(file['absolutePath']);

                // Load created file elements from subdirectory into new container,
                // and add the new container to the current container.
                window.fs
                    .listDir(file['absolutePath'])
                    .then(files => files.map(file => new AbstractFile(file['name'], file['path'], file['isFile'], file['isDir'], file['isSymLink'])))
                    .then(files => FileHierarchy.loadFiles(files, nextContainer, indentation + 1));

                container.appendChild(nextContainer);
            }
        }
    },
    /**
     * Function for opening a file hierarchy element. If the element doesn't exist,
     * the returned promise will be rejected.
     * @param {string} absolutePath The absolute path to the file to open.
     * @param {number} indentation The indentation level of the file hierarchy.
     * @returns {Promise<void>} Whether the opening of the file hierarchy element was successful.
     */
    openElement: function(absolutePath, indentation = 0)
    {
        return new Promise((resolve, reject) =>
        {
            let fileElement = document.querySelector(`.file-hierarchy-element[absolute-path="${absolutePath}"]`);
            // If the element doesn't exist, reject the promise.
            if ( !fileElement )
                reject();
            else
            {
                // If it's already opened, resolve the promise and stop.
                if ( fileElement.getAttribute('expanded') === 'true' )
                    return resolve();

                // Expand the file hierarchy element.
                fileElement.setAttribute('expanded', 'true');

                // Create a new container, move the element in it and load the files from the directory.
                let subContainer = FileHierarchy.createContainer(absolutePath);

                fileElement.insertAdjacentElement('afterend', subContainer);

                // Open the file in the file hierarchy.
                window.fs.listDir(absolutePath)
                    .then(files => files.map(file => new AbstractFile(file['name'], file['path'], file['isFile'], file['isDir'], file['isSymLink'])))
                    .then(files => FileHierarchy.loadFiles(files, subContainer, indentation))
                    .then(resolve)
                    .catch(reject);
            }
        });
    },
    /**
     * Function for closing a file hierarchy element. If the element doesn't exist,
     * the returned promise will be rejected.
     * @param {string} absolutePath The absolute path to the file to close.
     * @returns {Promise<void>}
     */
    closeElement: function(absolutePath)
    {
        return new Promise((resolve, reject) =>
        {
            let fileElement = document.querySelector(`.file-hierarchy-element[absolute-path="${absolutePath}"]`);
            if ( !fileElement )
                reject();
            else
            {
                // If the file hierarchy element is already closed, resolve the promise and stop.
                if ( fileElement.getAttribute('expanded') === 'false' )
                    return resolve();

                fileElement.setAttribute('expanded', 'false');
                fileElement.nextElementSibling.remove();
                resolve();
            }
        });
    },

    /**
     * Function for creating a file hierarchy element.
     * This function creates all the basic elements for a file hierarchy item, and configures
     * them accordingly.
     * @param {AbstractFile} file
     * @param {number} indent The indentation level of the file hierarchy.
     */

    createElement: function(file, indent = 0)
    {
        let mainElement = document.createElement('div');
        mainElement.classList.add('file-hierarchy-element');
        mainElement.setAttribute('path', file['path']);
        mainElement.setAttribute('name', file['name']);
        mainElement.setAttribute('absolute-path', file['absolutePath']);
        mainElement.style.setProperty('--indent', indent);
        mainElement.draggable = true;

        // If file is directory, add 'expanded' and 'directory' attribute
        if ( file['isDir'] )
        {
            mainElement.setAttribute('directory', '');
            mainElement.setAttribute('expanded', 'false');
        }

        // Special file attributes
        file['isFile'] && mainElement.setAttribute('file', '');
        file['isSymLink'] && mainElement.setAttribute('symlink', '');

        let fileElementIcon = document.createElement('span');
        let thumbnail = window.fs.files.getThumbnail(file['isDir'] ? 'directory' : file['name'].split('.').pop());
        fileElementIcon.style.backgroundImage = `url(${thumbnail})`;
        fileElementIcon.classList.add('file-hierarchy-item-icon');

        let fileElementTitle = document.createElement('span');
        fileElementTitle.classList.add('file-hierarchy-file-name');
        fileElementTitle.innerText = file['name'];

        mainElement.appendChild(fileElementIcon);
        mainElement.appendChild(fileElementTitle);
        return mainElement;

    },

    /**
     * Function for creating a file hierarchy container element.
     * This is a representation of a file directory that's open.
     * @param {string} originPath The file path to the container.
     * @returns {HTMLDivElement} The created element.
     */
    createContainer: function(originPath)
    {
        let newContainer = document.createElement('div');
        newContainer.classList.add('container', 'file-hierarchy-container');
        newContainer.setAttribute('path', originPath);
        return newContainer;
    }

}
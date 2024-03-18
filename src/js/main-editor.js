/**
 * Main editor script file.
 * @author Luca Warmenhoven
 * Created on Friday, 8th of March 2024.
 */

const LOCAL_STORAGE_OBJ_SEPARATOR = ',';
const FS_CHANGES_CHECK_INTERVAL = 1000;

let __showHidden = Boolean(localStorage['showHiddenFiles']) || false;

const FileTypes = {
    image: {
        requireFileRead: false,
        extensions: [ 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg' ],
        loadFn: loadImageContent
    },
    video: {
        requireFileRead: false,
        extensions: [ 'mp4', 'webm', 'avi', 'mkv', 'mov', 'flv' ],
        loadFn: () =>
        {
        }
    },
    audio: {
        requireFileRead: false,
        extensions: [ 'mp3', 'wav', 'flac', 'ogg', 'm4a' ],
        loadFn: () =>
        {
        }
    },
    font: {
        requireFileRead: true,
        extensions: [ 'ttf', 'otf', 'woff', 'woff2' ],
        loadFn: () =>
        {
        }
    },
    text: {
        requireFileRead: true,
        extensions: [],
        loadFn: loadEditorContent
    }
}

/** @type {null | 'image' | 'video' | 'text' | 'audio'} */
let currentFileType = null

// When the page is loaded, register event listeners for all action buttons.
document.addEventListener('DOMContentLoaded', () =>
{
    window.mainWindow = createEditorWindow(true);
    window.mainWindow.id = 'editor-main';
    window.editor = document.getElementById('file-editor');

    localStorage['indentation'] = localStorage['indentation'] || 4;
    window.__indentation = parseInt(localStorage['indentation']);

    // If there's a last opened file stored in local storage, load the file data.
    if ( localStorage.hasOwnProperty('lastOpenedFile') )
        openFile(localStorage['lastOpenedFile'], window.mainWindow);

    if ( localStorage['openFiles'] )
    { /* TODO: Implement */ }

    setInterval(_ => {

    }, FS_CHANGES_CHECK_INTERVAL);

    let resizingElement = null;

    // Register event listeners for horizontal and vertical resize bars
    document
        .querySelectorAll('.resize-bar')
        .forEach(element =>
            element.addEventListener('mousedown', _ => resizingElement = element));

    document
        .addEventListener('mousemove', event =>
        {
            if ( resizingElement )
            {
                if ( resizingElement.classList.contains('resize-horizontal') )
                {
                    let target = resizingElement.getAttribute('data-resize-target');
                    let targetElement = document.getElementById(target);
                    targetElement.style.width = `${event.clientX - targetElement.offsetLeft}px`;
                }
                else if ( resizingElement.classList.contains('resize-vertical') )
                {
                    let target = resizingElement.getAttribute('data-resize-target');
                    let targetElement = document.getElementById(target);
                    targetElement.style.right = `${event.clientY}px`;
                }
            }
        })

    // Register event listeners for when mouse button is released,
    // remove the 'active' attribute.
    document.addEventListener('mouseup', _ => resizingElement = null);

    // If there's a current project directory stored in local storage,
    // load the file hierarchy from that directory.
    if ( localStorage['projectData'] )
    {
        let [ dirName, projectPath ] = localStorage['projectData'].split(LOCAL_STORAGE_OBJ_SEPARATOR);
        loadProject(projectPath, dirName);
    }
    else
    {
        // TODO: Implement a project selection window.
    }
});

/**
 * Function for loading a project.
 * @param {string} projectPath The path to the project.
 * @param {string} dirName The name of the directory to load.
 */
function loadProject(projectPath, dirName)
{
    localStorage['projectData'] = `${dirName}${LOCAL_STORAGE_OBJ_SEPARATOR}${projectPath}`;

    // Main container containing the file hierarchy.
    let mainContainer = document.getElementById('file-hierarchy');

    // Container containing the directory of the project
    let hierarchyContainer = FileHierarchy.createContainer(projectPath);
    mainContainer.appendChild(hierarchyContainer);
    FileHierarchy.loadFiles([ new AbstractFile(dirName, projectPath, false, true, false) ], hierarchyContainer);
}

/**
 * Function for loading in the file data from a provided file path.
 * This data is then processed by the 'parseFileContent' function.
 * @param {string} fileAbsolutePath The absolute path to the file to open.
 * @param {HTMLElement} editorWindow The window to open the file in.
 */
function openFile(fileAbsolutePath, editorWindow)
{
    // If the file is already open, don't open it again.
    if ( window['currentFilePath'] === fileAbsolutePath )
        return;

    // If there's no provided editor window, use the main one.
    if ( !editorWindow )
        editorWindow = window.mainWindow;

    let fileType = fileAbsolutePath.split('.').pop();
    currentFileType = Object.keys(FileTypes)
        .find(type => FileTypes[type].extensions?.includes(fileType)) || 'text';

    // Deselect all open file elements
    document
        .querySelectorAll('.open-file-element[selected]')
        .forEach(element => element.removeAttribute('selected'));

    // Check if there's already an open file with the same path.
    if ( !editorWindow.querySelector('.open-file-element[file-path="' + fileAbsolutePath + '"]') )
    {
        let openFileElement = document.createElement('div');
        openFileElement.classList.add('open-file-element');
        openFileElement.setAttribute('file-path', fileAbsolutePath);
        openFileElement.setAttribute('selected', '')
        openFileElement.addEventListener('click', _ => {
            openFile(fileAbsolutePath, editorWindow);
            openFileElement.setAttribute('selected', '');
        });

        let openFileElementText = document.createElement('span');
        openFileElementText.classList.add('open-file-text');
        openFileElementText.innerText = fileAbsolutePath.split('/').pop();

        let openFileElementClose = document.createElement('span');
        openFileElementClose.classList.add('close-file');

        openFileElement.appendChild(openFileElementText);
        openFileElement.appendChild(openFileElementClose);

        editorWindow.querySelector('.open-files-container').appendChild(openFileElement);
    }

    window['currentFilePath'] = fileAbsolutePath;
    localStorage['lastOpenedFile'] = fileAbsolutePath;

    // If we have to read the file content before parsing the file, do so
    if ( FileTypes[currentFileType].requireFileRead )
    {
        window.fs
            .readFile(fileAbsolutePath)
            .then(content => FileTypes[currentFileType]?.loadFn(content, fileAbsolutePath, editorWindow, fileType));
    }
    else // If it isn't required, the file format is likely an image or video, therefore can be loaded as resource.
    {
        FileTypes[currentFileType]?.loadFn(fileAbsolutePath, editorWindow, fileType);
    }
}


/**
 * Function for parsing file data into the file editor.
 * @param {string} fileContent The data to parse.
 * @param {HTMLElement} editorWindow The window to parse the data into.
 * @param {string} fileOriginPath The path to the file.
 * @param {string} fileType The type of file. This is used in text parsing.
 */
function loadEditorContent(fileContent, fileOriginPath, editorWindow, fileType)
{
    let lines = fileContent.split('\n');
    let hiddenTextbox = document.querySelector('.file-content-textbox');
    let lineElementContainer = editorWindow.querySelector('.line-numbers-container');
    let mainContentContainer = editorWindow.querySelector('.file-content-container');
    let targetContainer = editorWindow.querySelector('.inner-file-content-container');

    // If the previous file was not a text file, we'll have to
    // recreate the necessary elements.
    if ( !lineElementContainer || !mainContentContainer || !hiddenTextbox)
    {

        hiddenTextbox = document.createElement('textarea');
        hiddenTextbox.classList.add('file-content-textbox');

        // Line numbers container
        lineElementContainer = document.createElement('div');
        lineElementContainer.classList.add('f-col-nowrap', 'line-numbers-container');
        targetContainer.appendChild(lineElementContainer);

        // File lines container
        mainContentContainer = document.createElement('pre');
        mainContentContainer.classList.add('file-content-container', 'f-col-nowrap');
        mainContentContainer.appendChild(hiddenTextbox);
        targetContainer.appendChild(mainContentContainer);
    }
    else
        mainContentContainer.innerHTML = '';

    // Highlight the file content
    window.grammar.format(fileContent, fileType)
        .then(tokens =>
        {
            console.log(tokens)
        })

    // Create line number elements
    for ( let i = 0; i < lines.length; i++ )
        createLineNumberElement(lines[i], i + 1, mainContentContainer);

    updateLineNumbers(lineElementContainer, lines.length);
}

/**
 * Function for loading the line number elements into the file editor.
 * @param {HTMLElement} container The container to load the line number elements into.
 * @param {number} lineNumberCount The amount of line numbers to load.
 */
function updateLineNumbers(container, lineNumberCount)
{
    let currentLineNrElements = container.querySelectorAll('.line-number');

    // If the current line number elements are more than the line number count,
    // remove the difference of elements.
    if ( currentLineNrElements.length > lineNumberCount )
    {
        for ( let i = lineNumberCount; i < currentLineNrElements.length; i++ )
            currentLineNrElements[i].remove();
    }

        // If the current line number elements are less than the line number count,
    // add the difference of elements.
    else if ( currentLineNrElements.length < lineNumberCount )
    {
        for ( let i = currentLineNrElements.length; i < lineNumberCount; i++ )
        {
            let element = document.createElement('div');
            element.classList.add('line-number');
            container.appendChild(element);
        }
    }
}

/**
 * Function for creating a line element. This line is not parsed and formatted yet.
 * @param {string} lineHtml The line to add to the file editor
 * @param {number} lineNumber The line number of the line
 * @param {HTMLElement} container The container to add the line to
 */
function createLineNumberElement(lineHtml, lineNumber, container)
{
    if ( !container )
        return;
    const element = document.createElement('div');
    element.classList.add('file-line');
    element.setAttribute('line-number', `${lineNumber}`);
    element.innerText = lineHtml;
    container.appendChild(element);
}

/**
 * Function for loading an image-kind of file into the file editor.
 * @param {string} fileAbsolutePath The absolute path to the file to load.
 * @param {HTMLElement} editorWindow The window to load the file into.
 */
function loadImageContent(fileAbsolutePath, editorWindow)
{
    let img = new Image();
    img.classList.add('contained-image');
    img.id = 'contained-image';
    img.src = fileAbsolutePath;
    document.getElementById('contained-image')?.remove(); // Remove the previous image if it exists
    editorWindow.querySelector('.inner-file-content-container').appendChild(img);
}

/**
 * Function for creating a new file editor window.
 * @param {boolean} append Whether to append the created window to the document or not.
 * @returns {HTMLDivElement} The created file editor window.
 */
function createEditorWindow(append = false)
{
    let newWindowElement = document.createElement('div');
    newWindowElement.classList.add('main-content');

    const index = document.querySelectorAll('.main-content').length + 1;

    newWindowElement.id = `window-${index}`;
    newWindowElement.addEventListener('click', _ => window['currentActiveEditor'] = newWindowElement);

    // The container which holds the open files.
    let activeFilesContainer = document.createElement('div');
    activeFilesContainer.classList.add('open-files-container');
    activeFilesContainer.id = 'active-files-container-' + index;

    newWindowElement.appendChild(activeFilesContainer);

    // Container for line numbers and file content or preview.
    let innerContentContainer = document.createElement('div');
    innerContentContainer.classList.add('inner-file-content-container');
    newWindowElement.appendChild(innerContentContainer);

    if ( append )
        document.getElementById('file-editor').appendChild(newWindowElement);

    window['currentActiveEditor'] = newWindowElement;

    return newWindowElement;
}
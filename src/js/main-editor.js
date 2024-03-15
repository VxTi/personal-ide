/**
 * Main editor script file.
 * @author Luca Warmenhoven
 * Created on Friday, 8th of March 2024.
 */

const LOCAL_STORAGE_OBJ_SEPARATOR = ',';

let __showHidden = Boolean(localStorage['showHiddenFiles']) || false;

// When the page is loaded, register event listeners for all action buttons.
document.addEventListener('DOMContentLoaded', () =>
{
    let actionButtons = document
        .querySelectorAll('.action');

    window.editor = document.getElementById('file-editor');

    localStorage['indentation'] = localStorage['indentation'] || 4;
    window.__indentation = parseInt(localStorage['indentation']);

    // If there's a last opened file stored in local storage, load the file data.
    if ( localStorage.hasOwnProperty('lastOpenedFile') )
        loadFileData(localStorage['lastOpenedFile'], window.editor);

    if ( localStorage['openFiles'] )
    {

    }

    // Add click functionality for all action buttons.
    actionButtons
        .forEach(element =>
            element.addEventListener('click', () => actionFired(element)));

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
    FileHierarchy.loadFiles([ new AbstractFile(dirName, projectPath, false, true, false)], hierarchyContainer);
}

/**
 * Function for loading in the file data from a provided file path.
 * This data is then processed by the 'parseFileContent' function.
 * @param fileAbsolutePath
 * @param editorWindow
 */
function loadFileData(fileAbsolutePath, editorWindow)
{
    localStorage['lastOpenedFile'] = fileAbsolutePath;
    console.time('file-reading')
    window.fs
        .readFile(fileAbsolutePath)
        .then(content => parseFileContent(content, editorWindow))
        .then(_ => console.timeEnd('file-reading'))
}

/**
 * Function for parsing file data into the file editor.
 * @param {string} fileContent The data to parse.
 * @param {HTMLElement} editorWindow The window to parse the data into.
 */
function parseFileContent(fileContent, editorWindow)
{
    let lines = fileContent.split('\n');
    let lineElementContainer = editorWindow.querySelector('.line-numbers-container');
    let mainContentContainer = editorWindow.querySelector('.file-content-container');

    mainContentContainer.innerHTML = '';

    // Highlight the file content
    console.time('code-grammar');
    window.grammar.format(fileContent, 'js')
        .then(tokens => {
            console.log(tokens);
            console.timeEnd('code-grammar');
        })

    // Create line number elements
    for ( let i = 0; i < lines.length; i++ )
        createLineElement(lines[i], i + 1, mainContentContainer);

    loadFileNumberElements(lineElementContainer, lines.length);
}

/**
 * Function for loading the line number elements into the file editor.
 * @param {HTMLElement} container The container to load the line number elements into.
 * @param {number} lineNumberCount The amount of line numbers to load.
 */
function loadFileNumberElements(container, lineNumberCount)
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
function createLineElement(lineHtml, lineNumber, container)
{
    if ( !container )
        return;
    const element = document.createElement('div');
    element.classList.add('file-line');
    element.setAttribute('line-number', `${lineNumber}`);
    element.innerHTML = lineHtml;
    container.appendChild(element);
}

function actionFired(element)
{
    if ( element.hasAttribute('selected') )
        element.removeAttribute('selected');
    else element.setAttribute('selected', '');

    let isSelected = element.hasAttribute('selected');
}


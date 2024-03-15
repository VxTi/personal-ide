const __fsPromises = require('fs/promises');
const nodePath = require('node:path');

// Object containing grammar files and their content.
let grammarFiles = {};

/**
 * Function for registering a grammar file into the application.
 * Grammar files can be used to tokenize and parse file content.
 * It functions as a lexical analyzer, so that files can be highlighted based
 * on their content.
 * @param {string} grammarFileName The name of the grammar file to register. These are found in the grammar folder in
 * /resources/grammar/
 */
async function registerLanguage(grammarFileName)
{
    return new Promise((resolve, reject) =>
    {

        // Check if grammar file is already loaded, if so, resolve
        if ( grammarFiles.hasOwnProperty(grammarFileName) )
            return resolve();

        // Get the target path to the supposed grammar file in /resources/grammar/
        let targetPath = nodePath.join(__dirname, 'resources', 'grammar', grammarFileName + '.json');

        // Check if the file can be accessed (check for its existence)
        __fsPromises.access(targetPath, __fsPromises.constants.F_OK)
            .then(async _ =>
            {
                // Read content of file and parse it as JSON.
                __fsPromises.readFile(targetPath, 'utf-8')
                    .then(content => JSON.parse(content))
                    .then(json =>
                    {
                        // TODO: Parse file input to see if it has the required format.
                        grammarFiles[grammarFileName] = json;
                        resolve();
                    })
                    .catch(error => reject(`Failed to read grammar file ${grammarFileName}`, error));
            })
            .catch(_ => reject(`Failed to find grammar file ${grammarFileName}`))
    });
}

/**
 * Function for retrieving a grammar file object for a specific file extension.
 * @param {string} extension The file extension to retrieve the grammar file for.
 * @returns {Object|undefined} The grammar file object, or undefined if it does not exist.
 */
function getGrammar(extension)
{
    for ( let grammarFile of Object.keys(grammarFiles) )
    {
        if ( grammarFiles[grammarFile]['extension_types'].includes(extension) )
            return grammarFiles[grammarFile];
    }
    return undefined;
}

/**
 * Function for converting a string of file content into an array of highlighted lines.
 * @param {string} content The file content to highlight.
 * @param {string} fileType The file extension to highlight the content with.
 * This must be present in the registered grammar files. If not, it will return plain text.
 * @returns {string[]} The highlighted lines of the file content, if there's an available grammar object
 * to highlight the content with.
 */
function highlight(content, fileType)
{
    let grammar = getGrammar(fileType);

    // If the grammar object does not exist, return plain text.
    if ( !grammar )
        return content.split('\n');

    let tokens = tokenize(content, grammar);

    return tokens;
}

/**
 * Function for tokenizing
 * @param {string} content The content to tokenize
 * @param {Object} grammarFile The grammar file object to use for tokenizing the content.
 * @returns {{priority: number, match: string, grammarRef: string, index: number, length: number}[]} An array of token objects.
 */
function tokenize(content, grammarFile)
{
    // If no grammar file is provided, return an empty array (no tokens)
    if ( !grammarFile )
        return [];

    // The stored tokens.
    /** @type {{priority: number, match: string, grammarRef: string, index: number, length: number}[]} >*/
    let tokens = [];

    // Iterate over the key types in the grammar file.
    Object
        .keys(grammarFile['grammar'])
        .forEach(keyType =>
        {
            // Go through all sub-definitions of the keyType's patterns
            // and find matches with the provided content
            grammarFile['grammar'][keyType]['patterns']
                .forEach(key =>
                {
                    let regex = new RegExp(key.expression, 'g');

                    // Iterate over all matches
                    for ( let match; (match = regex.exec(content))?.length > 0 && match; )
                    {
                        tokens.push({
                            priority: grammarFile['grammar'][keyType]['priority'],
                            match: match[0],
                            grammarRef: `${keyType}:${key.kind}`,
                            index: match.index,
                            length: match[0].length
                        });
                    }
                })
        });

    // Filter out tokens that have a lower priority and exist at the same position
    // as higher priority, longer tokens.

    // Low priority tokens
    FIRST_LOOP: for ( let i = tokens.length - 1; i >= 0; i-- )
    {
        // High priority tokens
        for ( let j = i - 1; j >= 0; j-- )
        {
            if (tokens[i].index === tokens[j].index)
            {
                if (tokens[i].priority < tokens[j].priority)
                    tokens.splice(i--, 1);
                else if (tokens[i].priority > tokens[j].priority)
                {
                    tokens.splice(j--, 1);
                    continue FIRST_LOOP;
                }
            }
        }
    }
    return tokens.sort((a, b) => a.index - b.index);
}

exports.tokenize = tokenize;
exports.highlight = highlight;
exports.registerLanguage = registerLanguage;
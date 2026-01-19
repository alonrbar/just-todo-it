import * as vscode from 'vscode';
import { TodoItem } from './types';

/**
 * Regex pattern to match TODO(label): text
 * Captures: [1] = label, [2] = text
 */
const TODO_PATTERN = /TODO\(([^)]+)\):\s*(.*)/g;

/**
 * Glob pattern for files to exclude from scanning
 */
const EXCLUDE_PATTERN = '{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/.next/**,**/build/**,**/*.min.js,**/*.min.css}';

/**
 * Scans the workspace for TODO comments matching the pattern TODO(label): text
 */
export class TodoScanner {
    /**
     * Scans all files in the workspace for TODO comments
     * @returns Array of TodoItem objects
     */
    async scanWorkspace(): Promise<TodoItem[]> {
        const todos: TodoItem[] = [];
        
        // Find all text files, excluding common non-source directories
        const files = await vscode.workspace.findFiles('**/*', EXCLUDE_PATTERN);
        
        // Filter to only text-like files
        const textFiles = files.filter(file => this.isTextFile(file.fsPath));
        
        // Scan each file in parallel
        const results = await Promise.all(
            textFiles.map(file => this.scanFile(file))
        );
        
        // Flatten results
        for (const fileTodos of results) {
            todos.push(...fileTodos);
        }
        
        return todos;
    }

    /**
     * Scans a single file for TODO comments
     * @param uri - The file URI to scan
     * @returns Array of TodoItem objects found in the file
     */
    async scanFile(uri: vscode.Uri): Promise<TodoItem[]> {
        const todos: TodoItem[] = [];
        
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            const lines = text.split('\n');
            
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            const relativePath = workspaceFolder 
                ? vscode.workspace.asRelativePath(uri, false)
                : uri.fsPath;

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                
                // Reset regex lastIndex for each line
                TODO_PATTERN.lastIndex = 0;
                
                let match: RegExpExecArray | null;
                while ((match = TODO_PATTERN.exec(line)) !== null) {
                    const label = match[1].trim();
                    const todoText = match[2].trim();
                    
                    todos.push({
                        label,
                        text: todoText,
                        filePath: uri.fsPath,
                        relativePath,
                        line: lineIndex,
                        column: match.index
                    });
                }
            }
        } catch (error) {
            // Silently skip files that can't be read (binary files, permission issues, etc.)
            console.warn(`Could not scan file ${uri.fsPath}:`, error);
        }
        
        return todos;
    }

    /**
     * Checks if a file is likely a text file based on its extension
     * @param filePath - The file path to check
     * @returns true if the file appears to be a text file
     */
    private isTextFile(filePath: string): boolean {
        const textExtensions = [
            // Programming languages
            '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
            '.py', '.pyw',
            '.java', '.kt', '.kts', '.scala',
            '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
            '.cs', '.fs', '.fsx',
            '.go',
            '.rs',
            '.rb', '.erb',
            '.php',
            '.swift',
            '.m', '.mm',
            '.lua',
            '.pl', '.pm',
            '.r', '.R',
            '.dart',
            '.ex', '.exs',
            '.clj', '.cljs', '.cljc',
            '.hs', '.lhs',
            '.elm',
            '.vue', '.svelte',
            // Web
            '.html', '.htm', '.xhtml',
            '.css', '.scss', '.sass', '.less', '.styl',
            // Data/Config
            '.json', '.jsonc', '.json5',
            '.xml', '.xsl', '.xslt',
            '.yaml', '.yml',
            '.toml',
            '.ini', '.cfg', '.conf',
            '.env',
            '.properties',
            // Documentation
            '.md', '.markdown', '.mdx',
            '.txt', '.text',
            '.rst',
            '.adoc',
            // Shell/Scripts
            '.sh', '.bash', '.zsh', '.fish',
            '.ps1', '.psm1', '.psd1',
            '.bat', '.cmd',
            // Other
            '.sql',
            '.graphql', '.gql',
            '.proto',
            '.tf', '.tfvars',
            '.dockerfile',
            '.makefile',
            '.gradle',
            '.cmake',
        ];

        const lowerPath = filePath.toLowerCase();
        
        // Check extension
        if (textExtensions.some(ext => lowerPath.endsWith(ext))) {
            return true;
        }
        
        // Check for common extensionless text files
        const fileName = lowerPath.split(/[/\\]/).pop() || '';
        const extensionlessTextFiles = [
            'dockerfile',
            'makefile',
            'gemfile',
            'rakefile',
            'procfile',
            'vagrantfile',
            'jenkinsfile',
            'brewfile',
            '.gitignore',
            '.gitattributes',
            '.editorconfig',
            '.prettierrc',
            '.eslintrc',
            '.babelrc',
            'license',
            'readme',
            'changelog',
            'contributing',
            'authors',
        ];
        
        return extensionlessTextFiles.some(name => fileName === name || fileName.startsWith(name + '.'));
    }
}

import * as vscode from 'vscode';
import { TodoItem } from '../types';
import { mapWithConcurrency } from '../utils/async';
import { matchesGlob } from '../utils/glob';
import { ScanCache } from './scanCache';
import { getExcludePattern, INCLUDE_PATTERN, MAX_FILE_SIZE_BYTES } from './scanFilePatterns';

/**
 * Regex pattern to match TODO(label): text
 * Captures: [1] = optional label, [2] = text
 */
const TODO_PATTERN = /TODO(?:\(([^)]+)\))?:\s*(.*)/g;
const UNLABELED_TODO_LABEL = 'unlabeled';

/**
 * Maximum number of files read concurrently during a workspace scan
 */
const SCAN_CONCURRENCY = 16;

const textDecoder = new TextDecoder('utf-8');

/**
 * Scans the workspace for TODO comments matching the pattern TODO(label): text
 */
export class TodoScanner implements vscode.Disposable {

    /**
     * Exclude pattern per workspace folder URI, from the last workspace scan
     */
    private readonly excludePatterns = new Map<string, string>();

    private readonly cache: ScanCache;

    /**
     * @param state - Workspace state for persisting scan results between sessions
     */
    constructor(state: vscode.Memento) {
        this.cache = new ScanCache(state);
    }

    public dispose(): void {
        this.cache.dispose();
    }

    /**
     * Gets the TODOs from the scan cache, to show before the first workspace scan completes
     */
    public getCachedTodos(): TodoItem[] {
        return this.cache.getAllTodos();
    }

    /**
     * Scans all files in the workspace for TODO comments
     * @returns Array of TodoItem objects
     */
    public async scanWorkspace(): Promise<TodoItem[]> {

        // Find all text files in each workspace folder, excluding the user's excludes and the folder's .gitignore rules
        const folders = vscode.workspace.workspaceFolders ?? [];
        const filesPerFolder = await Promise.all(folders.map(async folder => {
            const excludePattern = await getExcludePattern(folder);
            this.excludePatterns.set(folder.uri.toString(), excludePattern);
            return vscode.workspace.findFiles(new vscode.RelativePattern(folder, INCLUDE_PATTERN), excludePattern);
        }));

        const files = filesPerFolder.flat();
        const results = await this.scanFiles(files);

        // Forget files that are no longer part of the scan (deleted or excluded)
        this.cache.keepOnly(new Set(files.map(file => file.fsPath)));

        return results.flat();
    }

    /**
     * Forgets the scan results of deleted files
     * @param deletedPaths - Absolute paths of deleted files or folders
     */
    public removeFiles(deletedPaths: string[]): void {
        this.cache.deleteUnder(deletedPaths);
    }

    /**
     * Checks whether a file would be included in a workspace scan
     * @param uri - The file URI to check
     * @returns false for files outside the workspace, or before the first workspace scan started
     */
    public shouldScan(uri: vscode.Uri): boolean {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        const excludePattern = folder && this.excludePatterns.get(folder.uri.toString());
        if (!folder || excludePattern === undefined) {
            return false;
        }
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        return matchesGlob(relativePath, INCLUDE_PATTERN) && !matchesGlob(relativePath, excludePattern);
    }

    /**
     * Scans files on disk for TODO comments, with a bounded number of concurrent reads
     * @param uris - The file URIs to scan
     * @returns Array of TodoItem arrays, in the same order as the URIs
     */
    public scanFiles(uris: readonly vscode.Uri[]): Promise<TodoItem[][]> {
        return mapWithConcurrency(uris, SCAN_CONCURRENCY, uri => this.scanFile(uri));
    }

    /**
     * Scans a single file on disk for TODO comments
     * @param uri - The file URI to scan
     * @returns Array of TodoItem objects found in the file
     */
    public async scanFile(uri: vscode.Uri): Promise<TodoItem[]> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const cachedTodos = this.cache.get(uri.fsPath, stat);
            if (cachedTodos) {
                return cachedTodos;
            }

            let todos: TodoItem[] = [];
            if (stat.size <= MAX_FILE_SIZE_BYTES) {
                // Read raw bytes instead of opening a TextDocument, which is much more
                // expensive and notifies other extensions about every opened file
                const bytes = await vscode.workspace.fs.readFile(uri);
                todos = this.scanDocumentBody(uri, textDecoder.decode(bytes));
            }

            this.cache.set(uri.fsPath, stat, todos);
            return todos;
        } catch (error) {
            // Silently skip files that can't be read (binary files, permission issues, etc.)
            console.warn(`Could not scan file ${uri.fsPath}:`, error);
            this.cache.delete(uri.fsPath);
            return [];
        }
    }

    //
    // Private methods
    //

    private scanDocumentBody(fileUri: vscode.Uri, textContent: string): TodoItem[] {

        // Most files have no TODOs, so skip the per-line work for them
        if (!textContent.includes('TODO')) {
            return [];
        }

        const todos: TodoItem[] = [];
        const lines = textContent.split('\n');

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        const relativePath = workspaceFolder
            ? vscode.workspace.asRelativePath(fileUri, false)
            : fileUri.fsPath;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            // Reset regex lastIndex for each line
            TODO_PATTERN.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = TODO_PATTERN.exec(line)) !== null) {
                if (this.isInsideQuotedString(line, match.index)) {
                    continue;
                }

                const label = match[1]?.trim() || UNLABELED_TODO_LABEL;
                const todoText = match[2].trim();

                todos.push({
                    label,
                    text: todoText,
                    filePath: fileUri.fsPath,
                    relativePath,
                    line: lineIndex,
                    column: match.index
                });
            }
        }

        return todos;
    }

    /**
     * Checks whether a character position in a line is inside a quoted string.
     */
    private isInsideQuotedString(line: string, index: number): boolean {
        let activeQuote: "'" | '"' | '`' | null = null;
        let escaped = false;

        for (let i = 0; i < index; i++) {
            const char = line[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (activeQuote === null) {
                if (char === "'" || char === '"' || char === '`') {
                    activeQuote = char;
                }
            } else if (char === activeQuote) {
                activeQuote = null;
            }
        }

        return activeQuote !== null;
    }
}

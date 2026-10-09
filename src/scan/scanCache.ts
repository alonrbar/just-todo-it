import * as vscode from 'vscode';
import { TodoItem } from '../types';
import { isSameOrUnder } from '../utils/paths';

/**
 * Workspace state key and version of the scan cache.
 * Bump the version when the scan results change for the same file content.
 */
const CACHE_STATE_KEY = 'todoScanner.cache';
const CACHE_VERSION = 1;

/**
 * Delay for saving the scan cache, so bursts of changes cause a single save
 */
const CACHE_SAVE_DELAY_MS = 5000;

/**
 * Scan result of a file, valid as long as the file's modification time and size don't change
 */
interface CachedFile {
    mtime: number;
    size: number;
    todos: TodoItem[];
}

interface SavedCache {
    version: number;
    files: Record<string, CachedFile>;
}

/**
 * Scan results per absolute file path, persisted in workspace state between sessions
 * so unchanged files aren't read again. Changes are saved automatically.
 */
export class ScanCache implements vscode.Disposable {

    private readonly files = new Map<string, CachedFile>();
    private saveTimer: ReturnType<typeof setTimeout> | undefined;
    private savedSizeBytes = 0;

    private readonly onDidSaveEmitter = new vscode.EventEmitter<void>();

    /**
     * Fired after the cache is saved, when its saved size may have changed
     */
    public readonly onDidSave = this.onDidSaveEmitter.event;

    /**
     * @param state - Workspace state to load the cache from and save it to
     */
    constructor(private readonly state: vscode.Memento) {
        const savedCache = state.get<SavedCache>(CACHE_STATE_KEY);
        if (savedCache?.version === CACHE_VERSION) {
            for (const [filePath, cachedFile] of Object.entries(savedCache.files)) {
                this.files.set(filePath, cachedFile);
            }
            this.savedSizeBytes = JSON.stringify(savedCache).length;
        }
    }

    public dispose(): void {
        if (this.saveTimer) {
            this.save();
        }
        this.onDidSaveEmitter.dispose();
    }

    /**
     * Gets the approximate size of the saved cache, in bytes
     */
    public getSavedSizeBytes(): number {
        return this.savedSizeBytes;
    }

    /**
     * Gets the cached TODOs of a file
     * @param filePath - The absolute file path
     * @param stat - The current stat of the file
     * @returns The cached TODOs, or undefined if the file isn't cached or has changed since
     */
    public get(filePath: string, stat: vscode.FileStat): TodoItem[] | undefined {
        const cachedFile = this.files.get(filePath);
        if (cachedFile && cachedFile.mtime === stat.mtime && cachedFile.size === stat.size) {
            return cachedFile.todos;
        }
        return undefined;
    }

    /**
     * Caches the TODOs of a file
     * @param filePath - The absolute file path
     * @param stat - The stat of the file the TODOs were scanned from
     * @param todos - The TODOs found in the file
     */
    public set(filePath: string, stat: vscode.FileStat, todos: TodoItem[]): void {
        this.files.set(filePath, { mtime: stat.mtime, size: stat.size, todos });
        this.scheduleSave();
    }

    /**
     * Removes a file from the cache
     * @param filePath - The absolute file path
     */
    public delete(filePath: string): void {
        if (this.files.delete(filePath)) {
            this.scheduleSave();
        }
    }

    /**
     * Removes deleted files, and files under deleted folders, from the cache
     * @param deletedPaths - Absolute paths of deleted files or folders
     */
    public deleteUnder(deletedPaths: string[]): void {
        this.deleteWhere(filePath => deletedPaths.some(deletedPath => isSameOrUnder(filePath, deletedPath)));
    }

    /**
     * Removes all files except the given ones from the cache
     * @param filePaths - Absolute paths of the files to keep
     */
    public keepOnly(filePaths: Set<string>): void {
        this.deleteWhere(filePath => !filePaths.has(filePath));
    }

    /**
     * Gets the TODOs of all cached files
     */
    public getAllTodos(): TodoItem[] {
        return [...this.files.values()].flatMap(cachedFile => cachedFile.todos);
    }

    //
    // Private methods
    //

    private deleteWhere(predicate: (filePath: string) => boolean): void {
        for (const filePath of this.files.keys()) {
            if (predicate(filePath)) {
                this.delete(filePath);
            }
        }
    }

    private scheduleSave(): void {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.save(), CACHE_SAVE_DELAY_MS);
    }

    private save(): void {
        clearTimeout(this.saveTimer);
        this.saveTimer = undefined;
        const savedCache: SavedCache = {
            version: CACHE_VERSION,
            files: Object.fromEntries(this.files)
        };
        this.savedSizeBytes = JSON.stringify(savedCache).length;
        void this.state.update(CACHE_STATE_KEY, savedCache);
        this.onDidSaveEmitter.fire();
    }
}

import * as vscode from 'vscode';
import { TodoItem } from './types';
import { getExcludePattern, INCLUDE_PATTERN, MAX_FILE_SIZE_BYTES } from './scanFilePatterns';
import { mapWithConcurrency } from './utils';

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
export class TodoScanner {
  /**
   * Scans all files in the workspace for TODO comments
   * @returns Array of TodoItem objects
   */
  public async scanWorkspace(): Promise<TodoItem[]> {

    // Find all text files in each workspace folder, excluding the user's excludes and the folder's .gitignore rules
    const folders = vscode.workspace.workspaceFolders ?? [];
    const filesPerFolder = await Promise.all(folders.map(async folder => vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, INCLUDE_PATTERN),
      await getExcludePattern(folder)
    )));
    const files = filesPerFolder.flat();

    // Scan files with a bounded number of concurrent reads
    const results = await mapWithConcurrency(files, SCAN_CONCURRENCY, file => this.scanFile(file));

    return results.flat();
  }

  /**
   * Scans a single file on disk for TODO comments
   * @param uri - The file URI to scan
   * @returns Array of TodoItem objects found in the file
   */
  public async scanFile(uri: vscode.Uri): Promise<TodoItem[]> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > MAX_FILE_SIZE_BYTES) {
        return [];
      }

      // Read raw bytes instead of opening a TextDocument, which is much more
      // expensive and notifies other extensions about every opened file
      const bytes = await vscode.workspace.fs.readFile(uri);
      return this.scanDocumentBody(uri, textDecoder.decode(bytes));
    } catch (error) {
      // Silently skip files that can't be read (binary files, permission issues, etc.)
      console.warn(`Could not scan file ${uri.fsPath}:`, error);
      return [];
    }
  }

  /**
   * Scans an already-open document for TODO comments
   * @param document - The TextDocument to scan
   * @returns Array of TodoItem objects found in the document
   */
  public scanDocument(document: vscode.TextDocument): TodoItem[] {
    return this.scanDocumentBody(document.uri, document.getText());
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

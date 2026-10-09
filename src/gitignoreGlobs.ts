import * as vscode from 'vscode';

const textDecoder = new TextDecoder('utf-8');

/**
 * Converts .gitignore rules to globs that can be used as a findFiles exclude pattern.
 *
 * The conversion is approximate. Rules that can't be expressed as an exclude glob are skipped:
 * - Negated rules (`!pattern`), since exclude globs can't re-include files
 * - Rules with escapes (`\`), commas or braces, since they would break the combined glob group
 */
export class GitignoreGlobs {
  /**
   * Reads the .gitignore file at the root of a folder and converts its rules to globs
   * @param folder - The folder to read the .gitignore file from
   * @returns Globs relative to the folder, or an empty array if there is no .gitignore file
   */
  public static async fromFolderRoot(folder: vscode.Uri): Promise<string[]> {
    let content: string;
    try {
      content = textDecoder.decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder, '.gitignore')));
    } catch {
      // Most likely there is no .gitignore file
      return [];
    }
    return GitignoreGlobs.convert(content, '');
  }

  /**
   * Converts the content of a .gitignore file to globs
   * @param content - The .gitignore file content
   * @param directory - The workspace-relative directory of the .gitignore file ('' for the root)
   * @returns Globs relative to the workspace folder
   */
  public static convert(content: string, directory: string): string[] {
    return content
      .split(/\r?\n/)
      .flatMap(line => GitignoreGlobs.convertLine(line, directory));
  }

  //
  // Private methods
  //

  private static convertLine(line: string, directory: string): string[] {
    let pattern = line.trimEnd();

    // Skip empty lines, comments and negated rules
    if (!pattern || pattern.startsWith('#') || pattern.startsWith('!')) {
      return [];
    }

    if (/[\\{},]/.test(pattern)) {
      return [];
    }

    // A trailing slash means the rule only matches directories
    const directoryOnly = pattern.endsWith('/');
    if (directoryOnly) {
      pattern = pattern.slice(0, -1);
    }

    // A slash at the start or in the middle anchors the rule to the .gitignore directory,
    // otherwise it matches at any depth
    const anchored = pattern.includes('/');
    if (pattern.startsWith('/')) {
      pattern = pattern.slice(1);
    }
    if (!anchored) {
      pattern = `**/${pattern}`;
    }

    const glob = directory ? `${directory}/${pattern}` : pattern;

    // Without a trailing slash the rule may match a file or a directory, so cover both
    return directoryOnly ? [`${glob}/**`] : [glob, `${glob}/**`];
  }
}

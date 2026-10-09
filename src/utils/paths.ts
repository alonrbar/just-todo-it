import * as path from 'path';

/**
 * Checks whether a path is the same as, or inside, another path
 * @param filePath - The absolute path to check
 * @param parentPath - The absolute path of the possible parent folder
 * @returns true if filePath equals parentPath or is under it
 */
export function isSameOrUnder(filePath: string, parentPath: string): boolean {
    return filePath === parentPath || filePath.startsWith(parentPath + path.sep);
}

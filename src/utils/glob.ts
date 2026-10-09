/**
 * Compiled glob patterns, since the same large patterns are matched against many paths
 */
const compiledGlobs = new Map<string, RegExp>();

/**
 * Checks whether a relative path matches a glob pattern.
 * Supports `**`, `*`, `?`, `[...]` (with `!` negation) and a single level of `{a,b}` groups.
 *
 * @param relativePath - Path with forward slashes, relative to the glob's base folder
 * @param glob - The glob pattern
 * @returns true if the path matches the glob
 */
export function matchesGlob(relativePath: string, glob: string): boolean {
    let regExp = compiledGlobs.get(glob);
    if (!regExp) {
        regExp = globToRegExp(glob);
        compiledGlobs.set(glob, regExp);
    }
    return regExp.test(relativePath);
}

/**
 * Converts a glob pattern to a regular expression that matches whole paths
 */
function globToRegExp(glob: string): RegExp {
    let source = '';
    let inGroup = false;

    for (let i = 0; i < glob.length; i++) {
        const char = glob[i];

        if (char === '*' && glob[i + 1] === '*') {
            // '**/' matches zero or more folders, a trailing '**' matches anything
            i++;
            if (glob[i + 1] === '/') {
                i++;
                source += '(?:.*/)?';
            } else {
                source += '.*';
            }
        } else if (char === '*') {
            source += '[^/]*';
        } else if (char === '?') {
            source += '[^/]';
        } else if (char === '[' && glob.indexOf(']', i + 1) !== -1) {
            const end = glob.indexOf(']', i + 1);
            const range = glob.slice(i + 1, end).replace(/\\/g, '\\\\');
            source += range.startsWith('!') ? `[^${range.slice(1)}]` : `[${range}]`;
            i = end;
        } else if (char === '{' && !inGroup) {
            inGroup = true;
            source += '(?:';
        } else if (char === '}' && inGroup) {
            inGroup = false;
            source += ')';
        } else if (char === ',' && inGroup) {
            source += '|';
        } else {
            source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }

    return new RegExp(`^(?:${source})$`);
}

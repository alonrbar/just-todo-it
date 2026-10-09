import * as vscode from 'vscode';
import { GitignoreGlobs } from './gitignoreGlobs';

/**
 * Extensions of files that are likely to be text files
 */
const TEXT_FILE_EXTENSIONS = [
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

/**
 * Names of common text files without a known extension (also matched with any extension),
 * in their usual casing
 */
const EXTENSIONLESS_TEXT_FILES = [
  'Dockerfile', 'dockerfile',
  'Makefile', 'makefile',
  'Gemfile',
  'Rakefile',
  'Procfile',
  'Vagrantfile',
  'Jenkinsfile',
  'Brewfile',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.prettierrc',
  '.eslintrc',
  '.babelrc',
  'license',
  'LICENSE',
  'readme',
  'README',
  'changelog',
  'CHANGELOG',
  'contributing',
  'CONTRIBUTING',
  'authors',
  'AUTHORS',
];

/**
 * Glob pattern for files to scan, so non-text files are filtered out by the file search itself
 */
export const INCLUDE_PATTERN = '{' + [
  ...TEXT_FILE_EXTENSIONS.map(ext => `**/*${ext}`),
  ...EXTENSIONLESS_TEXT_FILES.flatMap(name => [
    `**/${name}`,
    `**/${name}.*`,
  ]),
].join(',') + '}';

/**
 * Globs for files that are always excluded from scanning.
 * The git directory is never listed in .gitignore and is expensive to walk.
 */
const ALWAYS_EXCLUDED_GLOBS = [
  '**/.git/**',
];

/**
 * Builds the glob pattern for files to exclude from scanning a workspace folder.
 * Passing an explicit exclude pattern to findFiles disables the user's exclude settings,
 * so they are merged in here, together with the folder's root .gitignore rules.
 * @param folder - The workspace folder to scan
 * @returns Glob pattern relative to the folder
 */
export async function getExcludePattern(folder: vscode.WorkspaceFolder): Promise<string> {
  const userGlobs = [
    ...getEnabledGlobs(vscode.workspace.getConfiguration('files', folder).get('exclude')),
    ...getEnabledGlobs(vscode.workspace.getConfiguration('search', folder).get('exclude')),
  ];
  const gitignoreGlobs = await GitignoreGlobs.fromFolderRoot(folder.uri);

  // Glob groups can't be nested, so skip user globs that contain their own groups
  return toGlobGroup([
    ...ALWAYS_EXCLUDED_GLOBS,
    ...userGlobs.filter(glob => !glob.includes('{')),
    ...gitignoreGlobs,
  ]);
}

/**
 * Combines globs into a single deduplicated glob group
 */
function toGlobGroup(globs: string[]): string {
  return `{${[...new Set(globs)].join(',')}}`;
}

/**
 * Returns the globs that are enabled in an exclude setting.
 * Conditional entries (e.g. `{ "when": "$(basename).ts" }`) are skipped.
 */
function getEnabledGlobs(excludeSetting: Record<string, unknown> | undefined): string[] {
  return Object.entries(excludeSetting ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([glob]) => glob);
}

/**
 * Files larger than this are skipped during a workspace scan (usually generated files)
 */
export const MAX_FILE_SIZE_BYTES = 1024 * 1024;

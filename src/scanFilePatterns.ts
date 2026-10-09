import { caseInsensitiveGlob } from './utils';

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
  '.r',
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
 * Names of common text files without a known extension (also matched with any extension)
 */
const EXTENSIONLESS_TEXT_FILES = [
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

/**
 * Glob pattern for files to scan, so non-text files are filtered out by the file search itself
 */
export const INCLUDE_PATTERN = '{' + [
  ...TEXT_FILE_EXTENSIONS.map(ext => `**/*${caseInsensitiveGlob(ext)}`),
  ...EXTENSIONLESS_TEXT_FILES.flatMap(name => [
    `**/${caseInsensitiveGlob(name)}`,
    `**/${caseInsensitiveGlob(name)}.*`,
  ]),
].join(',') + '}';

/**
 * Glob pattern for files to exclude from scanning
 */
export const EXCLUDE_PATTERN = '{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/.next/**,**/build/**,**/*.min.js,**/*.min.css}';

/**
 * Files larger than this are skipped during a workspace scan (usually generated files)
 */
export const MAX_FILE_SIZE_BYTES = 1024 * 1024;

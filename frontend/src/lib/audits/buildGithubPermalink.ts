/**
 * Converts a Git URL (HTTPS or SSH) to a clean web base URL.
 * Example:
 * - "https://github.com/user/repo.git" -> "https://github.com/user/repo"
 * - "git@github.com:user/repo.git" -> "https://github.com/user/repo"
 */
export function normalizeRepoUrl(url: string): string {
  let normalized = url.trim();

  // Handle SSH format git@github.com:org/repo.git
  if (normalized.startsWith('git@')) {
    normalized = normalized
      .replace(/^git@/, 'https://')
      .replace(/:(?=[^/])/, '/'); // replace colon before org with slash
  }

  // Strip trailing .git
  if (normalized.endsWith('.git')) {
    normalized = normalized.slice(0, -4);
  }

  // Ensure it starts with http:// or https://
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  return normalized;
}

/**
 * Builds a Github permalink for a specific file, commit, and line range.
 */
export function buildGithubPermalink(
  repoUrl: string,
  commitHash: string,
  filepath: string,
  startLine: number,
  endLine: number
): string {
  const base = normalizeRepoUrl(repoUrl);
  const commit = commitHash || 'main';
  const cleanPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
  
  // Format: base/blob/commit/filepath#Lstart-Lend
  return `${base}/blob/${commit}/${cleanPath}#L${startLine}-L${endLine}`;
}

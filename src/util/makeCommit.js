import git from 'simple-git/promise';
import path from 'path';

/**
 * Use nodegit to create a git commit at HEAD.
 */
export default async function makeCommit(getFiles, commitMessage, overrideAuthorName) {
  let cwd = process.cwd();
  let repo = git(cwd);
  let email = (await repo.raw(['config', '--get', 'user.email'])).trim();
  let opts = overrideAuthorName ? {'--author': `${overrideAuthorName} <${email}>`} : {};
  let files = await getFiles(repo, filePath => path.relative(cwd, filePath));
  await repo.add(files);
  return await repo.commit(commitMessage, files, opts);
}

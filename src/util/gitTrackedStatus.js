import git from 'simple-git/promise';

/**
 * Get the status for all tracked files in git.
 */
export default async function gitTrackedStatus () {
  return await git().status().then(s => s ? s.files : []);
};

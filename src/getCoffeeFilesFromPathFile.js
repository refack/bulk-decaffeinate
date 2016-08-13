import { exists, readFile } from 'mz/fs';

import CLIError from './CLIError';

/**
 * Read a list of .coffee files from a file and return it. Verify that all files
 * end in .coffee and that the files actually exist.
 */
export default async function getCoffeeFilesFromPathFile(filePath) {
  let fileContents = await readFile(filePath);
  let lines = fileContents.toString().split('\n');
  let resultLines = [];
  for (let line of lines) {
    line = line.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    if (!line.endsWith('.coffee')) {
      throw new CLIError(`The line "${line}" must be a file path ending in .coffee.`);
    }
    if (!(await exists(line))) {
      throw new CLIError(`The file "${line}" did not exist.`);
    }
    resultLines.push(line);
  }
  return resultLines;
}

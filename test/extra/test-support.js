/* eslint-env mocha */
import assert from 'assert';
import { exec } from 'mz/child_process';
import { exists, readFile, writeFile, mkdtemp, mkdir, rename } from 'mz/fs';
import { join, sep, normalize } from 'path';
import git from 'simple-git/promise';

import getFilesUnderPath from '../../src/util/getFilesUnderPath';

let originalCwd = process.cwd();

async function mkdTempSafe (prefix) {
  let parts = normalize(prefix).split(sep);
  // let last = parts.pop();
  let head = '';
  for (let part of parts) {
    try {
      head = join(head, part);
      await mkdir(head);
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
  }
  return await mkdtemp(prefix);
}

async function runCli (args) {
  let [stdout, stderr] = (await exec(`node "${join(originalCwd, 'bin', 'bulk-decaffeinate')}" \
    --decaffeinate-path "${join(originalCwd, 'node_modules', '.bin', 'decaffeinate')}" \
    --jscodeshift-path "${join(originalCwd, 'node_modules', '.bin', 'jscodeshift')}" \
    --eslint-path "${join(originalCwd, 'node_modules', '.bin', 'eslint')}" \
    ${args}`));
  return {stdout, stderr};
}

function assertIncludes (output, substr) {
  assert(
    output.includes(substr),
    `Expected the output to include "${substr}".\n\nFull output:\n${output}`
  );
}

async function assertFileContents (path, expectedContents) {
  let contents = (await readFile(path)).toString();
  assert.equal(contents, expectedContents);
}

async function assertFileIncludes (path, expectedSubstr) {
  let contents = (await readFile(path)).toString();
  assert(
    contents.includes(expectedSubstr),
    `Expected file to include "${expectedSubstr}".\n\nFull file contents:\n${contents}`
  );
}

async function assertFilesEqual (actualFile, expectedFile) {
  let actualContents = (await readFile(actualFile)).toString();
  let expectedContents = (await readFile(expectedFile)).toString();
  assert.equal(
    actualContents, expectedContents,
    `The file ${actualFile} did not match the expected file.`
  );
}

/**
 * Run the given async function inside a temporary directory starting from the
 * given example.
 */
async function runWithTemplateDir (exampleName, fn) {
  let newDirPref = `./test/tmp-projects/${exampleName}/tmp-`;
  let newDir;
  try {
    newDir = await mkdTempSafe(newDirPref);
    await exec(`cp -r "./test/examples/${exampleName}/." "${newDir}"`);
    process.chdir(newDir);
    await fn();
  } catch (e) {
    console.log('Assertion failure. Test data saved here:');
    console.log(`${originalCwd}${newDir.substr(1)}`);
    throw e;
  } finally {
    process.chdir(originalCwd);
  }
}

async function initGitRepo () {
  await exec('git init');
  await exec('git config user.name "Sample User"');
  await exec('git config user.email "sample@example.com"');
  await exec('git add -A');
  await exec('git commit -m "Initial commit"');
}

export {
  runWithTemplateDir,
  initGitRepo,
  assertFilesEqual,
  assertFileIncludes,
  assertFileContents,
  assertIncludes,
  runCli,
  getFilesUnderPath,
  exists,
  writeFile,
  rename,
  join,
  readFile,
  assert,
  git,
};

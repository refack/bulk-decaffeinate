/* eslint-env mocha */
import assert from 'assert';
import { exec } from 'mz/child_process';
import { exists, readFile, writeFile, mkdtemp, mkdir, rename } from 'mz/fs';
import { join, sep, normalize, resolve } from 'path';
import git from 'simple-git/promise';

import gitTrackedStatus from '../../src/util/gitTrackedStatus';
import getFilesUnderPath from '../../src/util/getFilesUnderPath';
import cli from '../../src/cli';
const {runCommand, argParse} = cli;

const originalCwd = resolve(join(__dirname, '..', '..'));

Error.stackTraceLimit = 1000;

class MockStream {
  constructor () {
    this.str = '';
  }

  write (str) {
    this.str += str;
  }
}

/**
 * @desc does basically the same as `mkdir -p` but in-proc, and last child is a tmpDir.
 * doesn't throw if parts of the path already exist.
 * @param {string} prefix
 * @returns {Promise.<string>}
 */
async function mkdTempSafe (prefix) {
  let parts = normalize(prefix).split(sep);
  let head = '';
  parts.pop();
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
  let argv = ['"fake"', '"gaga"',
    '--decaffeinate-path', `"${join(originalCwd, 'node_modules', '.bin', 'decaffeinate')}"`,
    '--jscodeshift-path', `"${join(originalCwd, 'node_modules', '.bin', 'jscodeshift')}"`,
    '--eslint-path', `"${join(originalCwd, 'node_modules', '.bin', 'eslint')}"`,
    ...args.split(' '),
  ];
  let [command, config] = await argParse(argv);
  global.oldConsole = global.oldConsole || global.console;
  let strm1 = new MockStream();
  let strm2 = new MockStream();
  try {
    Object.defineProperty(global, 'console', {value: new global.oldConsole.Console(strm1, strm2)});
    await runCommand(command, config);
  } finally {
    Object.defineProperty(global, 'console', {value: global.oldConsole});
  }
  let [stdout, stderr] = [strm1.str, strm2.str];
  return {stdout, stderr};
}

function assertIncludes (output, substr) {
  assert(
    output.includes(substr),
    `Expected the output to include '${substr}'.\n\nFull output:\n${output}`
  );
}

async function assertFileContents (path, expectedContents) {
  let contents = (await readFile(path)).toString().replace(/\r/g, '');
  expectedContents = expectedContents.replace(/\r/g, '');
  assert.equal(contents, expectedContents);
}

async function assertFileIncludes (path, expectedSubstr) {
  let contents = (await readFile(path)).toString();
  assert(
    contents.includes(expectedSubstr),
    `Expected file to include '${expectedSubstr}'.\n\nFull file contents:\n${contents}`
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
    await exec(`cp -r './test/examples/${exampleName}/.' '${newDir}'`);
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
  let repo = git();
  await repo.init();
  await repo.addConfig('user.name', 'Sample User');
  await repo.addConfig('user.email', 'sample@example.com');
  await repo.add('*');
  await repo.commit('Initial commit');
  return repo;
}


function assertStub(stub, actual){
  for (let k1 in Object.keys(stub)) {
    let stubItem = stub[k1];
    let actualItem = actual[k1];
    for (let k2 of Object.keys(stubItem)) {
      assert.equal(actualItem[k2], stubItem[k2]);
    }
  }

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
  gitTrackedStatus,
  assertStub,
};

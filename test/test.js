import {
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
} from './extra/test-direct-support';

describe('basic CLI', () => {
  it('shows a help message when invoked with no arguments', async function () {
    let {stdout} = await runCli('');
    assertIncludes(stdout, 'Usage:');
    assertIncludes(stdout, 'Commands:');
    assertIncludes(stdout, 'Options:');
  });
});

describe('simple-success', () => {
  it('discovers and runs files', async function () {
    let {stdout} = await runCli('check -d test/examples/simple-success');
    assertIncludes(stdout, 'Doing a dry run of decaffeinate on 2 files...');
    assertIncludes(stdout, 'All checks succeeded');
  });

  it('runs files from the current directory', async function () {
    await runWithTemplateDir('simple-success', async function () {
      let {stdout} = await runCli('check');
      assertIncludes(stdout, 'Doing a dry run of decaffeinate on 2 files...');
      assertIncludes(stdout, 'All checks succeeded');
    });
  });
});

describe('simple-error', () => {
  it('discovers two files and fails on one', async function () {
    let {stdout} = await runCli('check -d test/examples/simple-error');
    assertIncludes(stdout, 'Doing a dry run of decaffeinate on 2 files...');
    assertIncludes(stdout, '1 file failed to convert');

    await assertFileIncludes(
      'decaffeinate-errors.log',
      `===== ${join('test', 'examples', 'simple-error', 'error.coffee')}`
    );

    let results = JSON.parse((await readFile('decaffeinate-results.json')).toString());
    assert.equal(results.length, 2);
    assert.equal(results[0].path, join('test', 'examples', 'simple-error', 'error.coffee'));
    assert.notEqual(results[0].error, null);
    assert.equal(results[1].path, join('test', 'examples', 'simple-error', 'success.coffee'));
    assert.equal(results[1].error, null);

    await assertFileContents(
      'decaffeinate-successful-files.txt',
      `${join('test', 'examples', 'simple-error', 'success.coffee')}`
    );
  });
});

describe('file-list', () => {
  it('reads a path file containing two lines, and ignores the other file', async function () {
    let {stdout, stderr} = await runCli('check --path-file test/examples/file-list/files-to-decaffeinate.txt');
    assert.equal(stderr, '');
    assertIncludes(stdout, 'Doing a dry run of decaffeinate on 3 files...');
    assertIncludes(stdout, 'All checks succeeded');
  });
});

describe('specifying individual files', () => {
  it('allows specifying one file', async function () {
    let {stdout} = await runCli('check --file test/examples/simple-success/A.coffee');
    assertIncludes(stdout, 'Doing a dry run of decaffeinate on 1 file...');
    assertIncludes(stdout, 'All checks succeeded');
  });

  it('allows specifying two files', async function () {
    let {stdout} = await runCli(
      `check --file test/examples/simple-success/A.coffee \
        --file test/examples/simple-success/B.coffee`);
    assertIncludes(stdout, 'Doing a dry run of decaffeinate on 2 files...');
    assertIncludes(stdout, 'All checks succeeded');
  });
});

describe('config files', () => {
  it('reads the list of files from a config file', async function () {
    await runWithTemplateDir('simple-config-file', async function () {
      let {stdout, stderr} = await runCli('check');
      assert.equal(stderr, '');
      assertIncludes(stdout, 'Doing a dry run of decaffeinate on 1 file...');
      assertIncludes(stdout, 'All checks succeeded');
    });
  });
});

describe('convert', () => {
  describe('check git commit', () => {
    it('generates git commits converting the files', async function () {
      await runWithTemplateDir('simple-success', async function () {
        let repo = await initGitRepo();
        let {stdout, stderr} = await runCli('convert');
        assert.equal(stderr, '');
        assertIncludes(stdout, 'Successfully ran decaffeinate');

        let logSummery = await repo.log();
        let stub = [
          {
            message: 'decaffeinate: Run post-processing cleanups on A.coffee and 1 other file (HEAD -> master)',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'decaffeinate: Convert A.coffee and 1 other file to JS',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'decaffeinate: Rename A.coffee and 1 other file from .coffee to .js',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'Initial commit',
            author_name: 'Sample User',
            author_email: 'sample@example.com',
          },
        ];
        assertStub(stub, logSummery.all);
      });
    });

    it('generates a nice commit message when converting just one file', async function () {
      await runWithTemplateDir('simple-success', async function () {
        let repo = await initGitRepo();
        let {stdout, stderr} = await runCli('convert --file ./A.coffee');
        assert.equal(stderr, '');
        assertIncludes(stdout, 'Successfully ran decaffeinate');

        let logSummery = await repo.log();
        let stub = [
          {
            message: 'decaffeinate: Run post-processing cleanups on A.coffee (HEAD -> master)',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'decaffeinate: Convert A.coffee to JS',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'decaffeinate: Rename A.coffee from .coffee to .js',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'Initial commit',
            author_name: 'Sample User',
            author_email: 'sample@example.com',
          },
        ];
        assertStub(stub, logSummery.all);
      });
    });

    it('generates a nice commit message when converting three files', async function () {
      await runWithTemplateDir('file-list', async function () {
        let repo = await initGitRepo();
        let {stdout, stderr} = await runCli('convert --dir .');
        assert.equal(stderr, '');
        assertIncludes(stdout, 'Successfully ran decaffeinate');

        let logSummery = await repo.log();
        let stub = [
          {
            message: 'decaffeinate: Run post-processing cleanups on A.coffee and 3 other files (HEAD -> master)',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'decaffeinate: Convert A.coffee and 3 other files to JS',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'decaffeinate: Rename A.coffee and 3 other files from .coffee to .js',
            author_name: 'decaffeinate',
            author_email: 'sample@example.com',
          },
          {
            message: 'Initial commit',
            author_name: 'Sample User',
            author_email: 'sample@example.com',
          },
        ];
        assertStub(stub, logSummery.all);
      });
    });
  });


  it('runs jscodeshift', async function () {
    await runWithTemplateDir('jscodeshift-test', async function () {
      await initGitRepo();
      let {stdout} = await runCli('convert');
      assertIncludes(stdout, 'Successfully ran decaffeinate');

      await assertFileContents('./A.js', `\
/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let nameAfter = 3;
let notChanged = 4;
`);
    });
  });

  it('runs built-in jscodeshift scripts', async function () {
    await runWithTemplateDir('builtin-jscodeshift-script', async function () {
      await initGitRepo();
      let {stdout, stderr} = await runCli('convert');
      assert.equal(stderr, '');
      assertIncludes(stdout, 'Successfully ran decaffeinate');

      await assertFileContents('./Func.js', `\
/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
// This is a comment
function f() {
  console.log('Hello world');
}
`);
    });
  });

  it('prepends "eslint-env mocha" when specified', async function () {
    await runWithTemplateDir('mocha-env-test', async function () {
      await initGitRepo();
      let {stdout} = await runCli('convert');
      assertIncludes(stdout, 'Successfully ran decaffeinate');

      await assertFileContents('./A.js', `\
// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
console.log('This is production code');
`);

      await assertFileContents('./A-test.js', `\
// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/* eslint-env mocha */
console.log('This is test code');
`);
    });
  });

  it('runs eslint, applying fixes and disabling existing issues', async function () {
    await runWithTemplateDir('eslint-fix-test', async function () {
      await initGitRepo();
      let {stdout} = await runCli('convert');
      assertIncludes(stdout, 'Successfully ran decaffeinate');

      await assertFileContents('./A.js', `\
/* eslint-disable
    no-console,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const x = 2;
const y = 3;
console.log(x);
`);
    });
  });

  it('fails when .coffee and .js files both exist', async function () {
    await runWithTemplateDir('existing-js-file', async function () {
      await initGitRepo();
      let {stderr} = await runCli('convert');
      assertIncludes(stderr, 'The file A.js already exists.');
    });
  });

  it('fails when the git worktree has changes', async function () {
    await runWithTemplateDir('simple-success', async function () {
      let repo = await initGitRepo();
      await writeFile('A.coffee', 'echo "x = 2"');
      let {stderr} = await runCli('convert');
      assertIncludes(stderr, 'You have modifications to your git worktree.');
      await repo.add('A.coffee');
      ({stderr} = await runCli('convert'));
      assertIncludes(stderr, 'You have modifications to your git worktree.');
    });
  });

  it('generates backup files that are removed by clean', async function () {
    await runWithTemplateDir('simple-success', async function () {
      await initGitRepo();
      await runCli('convert');
      assert(
        await exists('./A.original.coffee'),
        'Expected a backup file to be created.'
      );
      await runCli('clean');
      assert(
        !await exists('./A.original.coffee'),
        'Expected the "clean" command to get rid of the backup file.'
      );
    });
  });

  it('handles a missing eslint config', async function () {
    await runWithTemplateDir('simple-success', async function () {
      await initGitRepo();
      let cliResult;
      try {
        await rename(join(__dirname, '../.eslintrc'), join(__dirname, '../.eslintrc.backup'));
        cliResult = await runCli('convert');
      } finally {
        await rename(join(__dirname, '../.eslintrc.backup'), join(__dirname, '../.eslintrc'));
      }
      assert.equal(cliResult.stderr, '');
      assertIncludes(cliResult.stdout, 'because there was no eslint config file');
    });
  });

  it('bypasses git commit hooks', async function () {
    await runWithTemplateDir('simple-success', async function () {
      let repo = await initGitRepo();
      if (process.platform === 'win32') {
        await writeFile('.git/hooks/commit-msg.bat', 'exit 1');
      } else {
        await writeFile('.git/hooks/commit-msg', '#!/bin/sh\nexit 1', {mode: 0o666});
      }
      let {stdout, stderr} = await runCli('convert');
      assert.equal(stderr, '');
      assertIncludes(stdout, 'Successfully ran decaffeinate');
      assert.equal((await repo.log()).all.length, '4');
    });
  });
});

describe('fix-imports', () => {
  async function runFixImportsTest (dirName) {
    await runWithTemplateDir(dirName, async function () {
      // We intentionally call the files ".js.expected" so that jscodeshift
      // doesn't discover and try to convert them.
      await initGitRepo();
      let {stdout, stderr} = await runCli('convert');
      assertIncludes(stdout, 'Fixing any imports across the whole codebase');
      assert.equal(stderr, '');

      let expectedFiles = await getFilesUnderPath('.', path => path.endsWith('.expected'));
      assert(expectedFiles.length > 0);
      for (let expectedFile of expectedFiles) {
        let actualFile = expectedFile.substr(0, expectedFile.length - '.expected'.length);
        await assertFilesEqual(actualFile, expectedFile);
      }
      let changedFiles = (await gitTrackedStatus())[0];
      assert.equal(changedFiles, '', 'Expected all file changes to be committed.');
    });
  }

  it('handles absolute imports', async function () {
    await runFixImportsTest('fix-imports-absolute-imports');
  });

  it('converts a default import to import * when necessary', async function () {
    await runFixImportsTest('fix-imports-default-import-to-import-star');
  });

  it('properly fixes import statements in pre-existing JS files', async function () {
    await runFixImportsTest('fix-imports-import-from-existing-js');
  });

  it('converts named imports to destructure statements when necessary', async function () {
    await runFixImportsTest('fix-imports-named-import-to-destructure');
  });

  it('properly handles existing JS code using import *', async function () {
    await runFixImportsTest('fix-imports-star-import-from-existing-js');
  });

  it('properly destructures from import * if necessary', async function () {
    await runFixImportsTest('fix-imports-destructure-from-import-star');
  });

  it('properly reads exports when "export function" is used', async function () {
    await runFixImportsTest('fix-imports-export-function');
  });

  it('uses an import * import when necessary even when there are no name usages', async function () {
    await runFixImportsTest('fix-imports-no-name-usages');
  });

  it('only does relative path resolution when an import is relative style', async function () {
    await runFixImportsTest('fix-imports-non-relative-path');
  });
});

describe('test git stuff', function () {
  it('should get status', async function () {
    let x = await gitTrackedStatus();
    console.log(x);
  });
});

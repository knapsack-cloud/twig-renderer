module.exports = {
  branch: 'master',
  preset: 'angular',
  plugins: [
    [
      // https://github.com/semantic-release/commit-analyzer
      '@semantic-release/commit-analyzer',
      {},
    ],
    [
      // https://github.com/semantic-release/release-notes-generator
      '@semantic-release/release-notes-generator',
      {},
    ],
    [
      // https://github.com/semantic-release/changelog
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      // https://github.com/semantic-release/npm
      // requires ENV vars: $NPM_TOKEN if npmPublish
      '@semantic-release/npm',
      {
        npmPublish: true,
      },
    ],
    [
      // https://github.com/semantic-release/git
      '@semantic-release/git',
      {
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}', // eslint-disable-line
        assets: ['CHANGELOG.md', 'package.json'],
      },
    ],
    [
      // https://github.com/semantic-release/github
      // requires ENV var: GITHUB_TOKEN
      '@semantic-release/github',
      {
        assignee: ['EvanLovely'],
      },
    ],
  ],
};

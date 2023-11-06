module.exports = {
  onlyPublishWithReleaseLabel: false,
  prereleaseBranches: [],
  baseBranch: 'master',
  author: 'KnapsackBot <53622700+KnapsackBot@users.noreply.github.com>',
  plugins: [
    [
      // https://intuit.github.io/auto/docs/generated/npm
      'npm',
      {},
    ],
    // https://intuit.github.io/auto/docs/generated/released
    'released',
  ],
};

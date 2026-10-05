module.exports = {
  onlyPublishWithReleaseLabel: false,
  prereleaseBranches: [],
  baseBranch: 'master',
  author: 'KnapsackBot <53622700+KnapsackBot@users.noreply.github.com>',
  plugins: [
    [
      // https://intuit.github.io/auto/docs/generated/npm
      // setRcToken: false — publishing authenticates with npm trusted
      // publishing (OIDC) from .github/workflows/push.yml, so auto must not
      // write an NPM_TOKEN line into ~/.npmrc.
      'npm',
      { setRcToken: false },
    ],
    // https://intuit.github.io/auto/docs/generated/released
    'released',
  ],
};

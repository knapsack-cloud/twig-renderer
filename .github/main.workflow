workflow "Main" {
  on = "push"
  resolves = [
    "semantic release",
    "eslint",
  ]
}

action "install" {
  uses = "docker://basaltinc/docker-node-php-base:latest"
  runs = ["sh", "-c", "npm install && composer install"]
}

action "build" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["install"]
  args = "run build"
}

action "docker://basaltinc/docker-node-php-base:latest" {
  uses = "docker://basaltinc/docker-node-php-base:latest"
  needs = ["build"]
  runs = "npm"
  args = "test"
}

action "if master" {
  uses = "actions/bin/filter@d820d56839906464fb7a57d1b4e1741cf5183efa"
  needs = ["docker://basaltinc/docker-node-php-base:latest"]
  args = "branch master"
}

action "semantic release" {
  uses = "docker://basaltinc/docker-node-php-base:latest"
  needs = ["if master"]
  runs = "npx"
  args = "semantic-release"
}

action "eslint" {
  uses = "hallee/eslint-action@master"
  needs = ["install"]
  secrets = ["GITHUB_TOKEN"]
}

workflow "New workflow" {
  on = "push"
  resolves = ["docker://basaltinc/docker-node-php-base:latest"]
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

<?php

// declare(strict_types=1);

use Twig\Environment;
use Twig\TwigFunction;

function addCustomExtension(Environment &$env, $config): void {
  $env->addFunction(new TwigFunction('customTwigFunctionThatSaysWorld', static fn(): string => 'Custom World'));
}

<?php

use Twig\Environment;
use Twig\TwigFunction;

function addCustomExtension(Environment &$env, $config) {
  $env->addFunction(new TwigFunction('customTwigFunctionThatSaysWorld', fn() => 'Custom World'));
}

<?php

function addCustomExtension(\Twig\Environment &$env, $config) {
  $env->addFunction(new \Twig\TwigFunction('customTwigFunctionThatSaysWorld', function () {
    return 'Custom World';
  }));
}

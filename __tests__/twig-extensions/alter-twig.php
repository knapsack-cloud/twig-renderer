<?php

function addCustomExtension(\Twig_Environment &$env) {
  $env->addFunction(new \Twig_SimpleFunction('customTwigFunctionThatSaysWorld', function () {
    return 'Custom World';
  }));
}

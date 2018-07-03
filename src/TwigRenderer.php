<?php

namespace BasaltInc\TwigRenderer;

class TwigRenderer {
  /**
   * @var $twig \Twig_Environment
   */
  private $twig;

  function __construct($config) {
    $loader = new \Twig_Loader_Filesystem($config['src']['roots']);

    if (isset($config['src']['namespaces'])) {
      foreach ($config['src']['namespaces'] as $namespace) {
        foreach ($namespace['paths'] as $path) {
          $loader->addPath($path, $namespace['id']);
        }
      }
    }

    $loaders = new \Twig_Loader_Chain([
      $loader,
    ]);

    $this->twig = new \Twig_Environment($loaders, [
      'debug' => $config['debug'],
      'autoescape' => $config['autoescape'],
    ]);
  }

  public function render($templatePath, $data = []) {
    try {
      $template = $this->twig->load($templatePath);
      $html = $template->render($data);
      $response = [
        'ok' => true,
        'html' => trim($html),
      ];
    } catch (\Exception $exception) {
      $response = [
        'ok' => false,
        'message' => $exception->getMessage(),
      ];
    }
    return $response;
  }

  /**
   * @return \Twig_Environment
   */
  public function getTwig() {
    return $this->twig;
  }
}

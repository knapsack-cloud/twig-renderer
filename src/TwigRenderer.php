<?php

namespace BasaltInc\TwigRenderer;

class TwigRenderer {
  /**
   * @var $twig \Twig_Environment
   */
  private $twig;

  /**
   * @var $loader \Twig_Loader_Filesystem
   */
  private $loader;

  function __construct($config) {
    $rootPath = getcwd();
    if (isset($config['relativeFrom'])) {
      $rootPath = $config['relativeFrom'];
    }
    $this->loader = new \Twig_Loader_Filesystem($config['src']['roots'], $rootPath);

    if (isset($config['src']['namespaces'])) {
      foreach ($config['src']['namespaces'] as $namespace) {
        foreach ($namespace['paths'] as $path) {
          $this->loader->addPath($path, $namespace['id']);
        }
      }
    }

    $loaders = new \Twig_Loader_Chain([
      $this->loader,
    ]);

    $this->twig = new \Twig_Environment($loaders, [
      'debug' => $config['debug'],
      'autoescape' => $config['autoescape'],
      'cache' => false, // @todo Implement Twig caching
    ]);

    if (isset($config['alterTwigEnv'])) {
      foreach ($config['alterTwigEnv'] as $alter) {
        $file = $alter['file'];
        require_once $file;
        foreach ($alter['functions'] as $function) {
          $function($this->twig, $config);
        }
      }
    }
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

  public function getInfo() {
    $info = [
      'namespaces' => $this->loader->getNamespaces(),
      'src' => array_map(function ($x) {
        return [
          'namespace' => $x,
          'paths' => $this->loader->getPaths($x),
        ];
      }, $this->loader->getNamespaces()),
    ];
    return $info;
  }
}

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

  /**
   * @var $config array - Configuration passed in
   */
  public $config;

  function __construct(array $config) {
    $this->config = $config;
    $rootPath = getcwd();
    if (isset($this->config['relativeFrom'])) {
      $rootPath = $this->config['relativeFrom'];
    }
    $this->loader = new \Twig_Loader_Filesystem($this->config['src']['roots'], $rootPath);

    if (isset($this->config['src']['namespaces'])) {
      foreach ($this->config['src']['namespaces'] as $namespace) {
        foreach ($namespace['paths'] as $path) {
          $this->loader->addPath($path, $namespace['id']);
        }
      }
    }

    $loaders = new \Twig_Loader_Chain([
      $this->loader,
    ]);

    $this->twig = $this->createTwigEnv($loaders);
  }

  private function createTwigEnv($loaders) {
    $twig = new \Twig_Environment($loaders, [
      'debug' => $this->config['debug'],
      'autoescape' => $this->config['autoescape'],
      'cache' => false, // @todo Implement Twig caching
    ]);

    if (isset($this->config['alterTwigEnv'])) {
      foreach ($this->config['alterTwigEnv'] as $alter) {
        $file = $alter['file'];
        require_once $file;
        foreach ($alter['functions'] as $function) {
          $function($twig, $this->config);
        }
      }
    }

    return $twig;
  }

  public function renderString($templateString, $data = []) {
    $templateName = 'StringRenderer'; // @todo ensure this simple name is ok; should be!
    $loader = new \Twig_Loader_Array([
      $templateName => $templateString,
    ]);
    
    $loaders = new \Twig_Loader_Chain([
      $loader,
      $this->loader,
    ]);
    
    $twig = $this->createTwigEnv($loaders);

    try {
      $html = $twig->render($templateName, $data);
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

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
   * @var $loaders \Twig_Loader_Chain
   */
  private $loaders;

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

    $this->loaders = new \Twig_Loader_Chain([
      $this->loader,
    ]);

    $this->twig = $this->createTwigEnv($this->loaders);
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
        'message' => '',
      ];
    } catch (\Exception $exception) {
      $message = 'Error trying to render twig string. ' . $exception->getMessage();
      $response = [
        'ok' => false,
        'message' => $message,
        'html' => '<pre><code>' . $message . '</code></pre>',
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
        'message' => '',
      ];
    } catch (\Exception $exception) {
      $message = 'Error trying to render "' . $templatePath . '". ' . $exception->getMessage();
      $response = [
        'ok' => false,
        'message' => $message,
        'html' => '<pre><code>' . $message . '</code></pre>',
      ];
    }
    if ($this->config['hasExtraInfoInResponses']) {
      $response['info'] = $this->getInfo();
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
    try {
      $info = [
        'namespaces' => $this->loader->getNamespaces(),
        'src' => array_map(function ($x) {
          return [
            'namespace' => $x,
            'paths' => $this->loader->getPaths($x),
          ];
        }, $this->loader->getNamespaces()),
        'extensions' => array_map(function ($ext) {
          return [
            'name' => $ext->getName(),
          ];
        }, $this->twig->getExtensions()),
      ];
    } catch (\Exception $e) {
      $info = [
        'message' => 'Exception thrown trying to get info. ' . $e->getMessage(),
      ];
    }
    return $info;
  }
}

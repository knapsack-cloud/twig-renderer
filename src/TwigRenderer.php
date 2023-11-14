<?php

// declare(strict_types=1);

namespace BasaltInc\TwigRenderer;

use Twig\Environment;
use Twig\Loader\ArrayLoader;
use Twig\Loader\ChainLoader;
use Twig\Loader\FilesystemLoader;

class TwigRenderer {
  /**
   * @var $twig Environment
   */
  private readonly \Twig\Environment $twig;

  /**
   * @var $loader FilesystemLoader
   */
  private readonly \Twig\Loader\FilesystemLoader $loader;

  /**
   * @var $loaders ChainLoader
   */
  private readonly \Twig\Loader\ChainLoader $loaders;

  function __construct(public array $config) {
    $rootPath = getcwd();
    if (isset($this->config['relativeFrom'])) {
      $rootPath = $this->config['relativeFrom'];
    }
    $this->loader = new FilesystemLoader($this->config['src']['roots'], $rootPath);

    if (isset($this->config['src']['namespaces'])) {
      foreach ($this->config['src']['namespaces'] as $namespace) {
        foreach ($namespace['paths'] as $path) {
          // The twigRenderer tries to access paths which 
          // might be not present anymore. In that case we 
          // have to catch this
          try {
            $this->loader->addPath($path, $namespace['id']);
          } catch (Throwable $e) {
            // ignore
          }
        }
      }
    }

    $this->loaders = new ChainLoader([
      $this->loader,
    ]);

    $this->twig = $this->createTwigEnv($this->loaders);
  }

  private function createTwigEnv(\Twig\Loader\ChainLoader $chainLoader): \Twig\Environment {
    $twigEnvironment = new Environment($chainLoader, [
      'debug' => $this->config['debug'],
      'autoescape' => $this->config['autoescape'],
      'cache' => false, // @todo Implement Twig caching
    ]);

    if (isset($this->config['alterTwigEnv'])) {
      foreach ($this->config['alterTwigEnv'] as $alter) {
        $file = $alter['file'];
        require_once $file;
        foreach ($alter['functions'] as $function) {
          $function($twigEnvironment, $this->config);
        }
      }
    }

    return $twigEnvironment;
  }

  public function renderString($templateString, array $data = []) {
    $templateName = 'StringRenderer'; // @todo ensure this simple name is ok; should be!
    $arrayLoader = new ArrayLoader([
      $templateName => $templateString,
    ]);

    $chainLoader = new ChainLoader([
      $arrayLoader,
      $this->loader,
    ]);

    $twig = $this->createTwigEnv($chainLoader);

    try {
      $html = $twig->render($templateName, $data);
      $response = [
        'ok' => true,
        'html' => trim((string) $html),
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

  public function render(string $templatePath, array $data = []) {
    try {
      $template = $this->twig->load($templatePath);
      $html = $template->render($data);
      $response = [
        'ok' => true,
        'html' => trim((string) $html),
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

  public function getTwig(): \Twig\Environment {
    return $this->twig;
  }

  public function getInfo() {
    try {
      $info = [
        'namespaces' => $this->loader->getNamespaces(),
        'src' => array_map(fn($x): array => [
          'namespace' => $x,
          'paths' => $this->loader->getPaths($x),
        ], $this->loader->getNamespaces()),
        'extensions' => array_map(fn($ext): array => [
          'name' => $ext->getName(),
        ], $this->twig->getExtensions()),
      ];
    } catch (\Exception $e) {
      $info = [
        'message' => 'Exception thrown trying to get info. ' . $e->getMessage(),
      ];
    }
    return $info;
  }
}

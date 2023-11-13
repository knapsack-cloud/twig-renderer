<?php

declare(strict_types=1);

namespace BasaltInc\TwigRenderer;

use Twig\Environment;
use Twig\Loader\ArrayLoader;
use Twig\Loader\ChainLoader;
use Twig\Loader\FilesystemLoader;

final class TwigRenderer
{
    private readonly Environment $twigEnvironment;

    private readonly FilesystemLoader $filesystemLoader;

    private readonly ChainLoader $chainLoader;

    public function __construct(public array $config)
    {
        $rootPath = getcwd();
        if (isset($this->config['relativeFrom'])) {
            $rootPath = $this->config['relativeFrom'];
        }

        $this->filesystemLoader = new FilesystemLoader($this->config['src']['roots'], $rootPath);

        if (isset($this->config['src']['namespaces'])) {
            foreach ($this->config['src']['namespaces'] as $namespace) {
                foreach ($namespace['paths'] as $path) {
                    $this->filesystemLoader->addPath($path, $namespace['id']);
                }
            }
        }

        $this->chainLoader = new ChainLoader([
            $this->filesystemLoader,
        ]);

        $this->twigEnvironment = $this->createTwigEnv($this->chainLoader);
    }

    public function renderString($templateString, array $data = [])
    {
        $templateName = 'StringRenderer'; // @todo ensure this simple name is ok; should be!
        $arrayLoader = new ArrayLoader([
            $templateName => $templateString,
        ]);

        $chainLoader = new ChainLoader([
            $arrayLoader,
            $this->filesystemLoader,
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
            $message = 'Error trying to render twig string. '.$exception->getMessage();
            $response = [
                'ok' => false,
                'message' => $message,
                'html' => '<pre><code>'.$message.'</code></pre>',
            ];
        }

        return $response;
    }

    public function render(string $templatePath, array $data = [])
    {
        try {
            $template = $this->twigEnvironment->load($templatePath);
            $html = $template->render($data);
            $response = [
                'ok' => true,
                'html' => trim((string) $html),
                'message' => '',
            ];
        } catch (\Exception $exception) {
            $message = 'Error trying to render "'.$templatePath.'". '.$exception->getMessage();
            $response = [
                'ok' => false,
                'message' => $message,
                'html' => '<pre><code>'.$message.'</code></pre>',
            ];
        }

        if ($this->config['hasExtraInfoInResponses']) {
            $response['info'] = $this->getInfo();
        }

        return $response;
    }

    public function getTwig(): Environment
    {
        return $this->twigEnvironment;
    }

    public function getInfo()
    {
        try {
            $info = [
                'namespaces' => $this->filesystemLoader->getNamespaces(),
                'src' => array_map(fn ($x): array => [
                    'namespace' => $x,
                    'paths' => $this->filesystemLoader->getPaths($x),
                ], $this->filesystemLoader->getNamespaces()),
                'extensions' => array_map(static fn ($ext): array => [
                    'name' => $ext->getName(),
                ], $this->twigEnvironment->getExtensions()),
            ];
        } catch (\Exception $exception) {
            $info = [
                'message' => 'Exception thrown trying to get info. '.$exception->getMessage(),
            ];
        }

        return $info;
    }

    private function createTwigEnv(ChainLoader $chainLoader): Environment
    {
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
}

<?php

declare(strict_types=1);

use BasaltInc\TwigRenderer;
use Psr\Http\Message\ServerRequestInterface;
use React\EventLoop\Loop;
use React\Http\Message\Response;
use React\Http\HttpServer;
use React\Promise\Promise;
use React\Socket\SocketServer;

require_once dirname(__DIR__).'/vendor/autoload.php';

// CLI args
$port = $argv[1];
$configFilePath = $argv[2];
// END: CLI args

// HTTP Status Codes Used
// 200 OK - The standard response for successful HTTP requests.
// 202 Accepted - The request has been accepted but has not been processed yet. This code does not guarantee that the request will process successfully.
// 400 Bad request - The request could not be fulfilled due to the incorrect syntax of the request.
// 404 Not found - The resource could not be found. This is often used as a catch-all for all invalid URIs requested of the server.
$responseCode = 202;
$configString = '';
$config = [];
$twigRenderer = null;
$counter = 0;
$maxConcurrency = 100;

try {
    $configString = file_get_contents($configFilePath);
} catch (\Exception $exception) {
    $msgs[] = 'No configFile found at: '.$configFilePath;
    $responseCode = 500;
}

try {
    $config = json_decode($configString, true, 512, JSON_THROW_ON_ERROR);
} catch (\Exception $exception) {
    $msgs[] = 'Error parsing JSON from config';
    $msgs[] = $exception->getMessage();
    $responseCode = 500;
}

$loop = Loop::get();

if ($config) {
    $twigRenderer = new TwigRenderer($config);

    if(array_key_exists('maxConcurrency', $config)) {
        $maxConcurrency = $config['maxConcurrency'];
    }
    //  file_put_contents(__DIR__ . '/info.json', json_encode($twigRenderer->getInfo()));
}

function formatResponseBody($msgs = [], $ok = false, $html = ''): string
{
    return json_encode([
        'ok' => $ok,
        'message' => implode(' ', $msgs),
        'html' => $html,
    ], JSON_THROW_ON_ERROR);
}

$server = new HttpServer(
    new React\Http\Middleware\StreamingRequestMiddleware(),
    new React\Http\Middleware\LimitConcurrentRequestsMiddleware($maxConcurrency),
    new React\Http\Middleware\RequestBodyBufferMiddleware(2 * 1024 * 1024), // 2 MiB per request
    static function (ServerRequestInterface $request) use ($twigRenderer, &$counter): Response|Promise {
        $headers = [
            'Content-Type' => 'application/json',
            'Access-Control-Allow-Origin' => '*',
        ];
        $msgs = [];
        ++$counter;
        $method = $request->getMethod();
        $query = $request->getQueryParams();
        $body = $request->getBody()->getContents();

        try {
            $body = json_decode($body ?: '{}', true, 512, JSON_THROW_ON_ERROR);
        } catch (\Exception $exception) {
            // @todo why doesn't this catch errors from malformed JSON?
            $msgs[] = 'Not able to parse JSON. '.$exception->getMessage();

            return new Response(400, $headers, formatResponseBody($msgs));
        }

        if (!isset($query['type'])) {
            return new Response(
                202,
                $headers,
                json_encode([
                    'ok' => true,
                    'message' => "No action correctly requested. Url must have a query param of 'templatePath' for which twig template to render, but yes - the server is running.",
                ])
            );
        }

        // one of: meta, renderFile, renderString
        $type = $query['type'];

        switch ($type) {
            case 'meta':
                return new Response(
                    200,
                    $headers,
                    json_encode([
                        'ok' => true,
                        'info' => $twigRenderer->getInfo(),
                        'meta' => [
                            'counter' => $counter,
                            'query' => $query,
                            'body' => $body,
                            'method' => $method,
                        ],
                    ], JSON_THROW_ON_ERROR)
                );

            case 'renderFile':
                return new Promise(static function ($resolve, $reject) use ($twigRenderer, $body, $headers): void {
                    $results = $twigRenderer->render($body['template'], $body['data']);
                    $response = new Response(
                        $results['ok'] ? 200 : 404,
                        $headers,
                        json_encode($results, JSON_THROW_ON_ERROR)
                    );
                    $resolve($response);
                });

            case 'renderString':
                return new Promise(static function ($resolve, $reject) use ($twigRenderer, $body, $headers): void {
                    $results = $twigRenderer->renderString($body['template'], $body['data']);
                    $response = new Response(
                        $results['ok'] ? 200 : 404,
                        $headers,
                        json_encode($results, JSON_THROW_ON_ERROR)
                    );
                    $resolve($response);
                });
        }
    }
);

$context = [];
$uri = sprintf('127.0.0.1:%u', $port);
$socket = new SocketServer($uri, $context, $loop);

$server->on('error', static function (Exception $exception): void {
    echo 'PHP TwigRenderer Error: '.$exception->getMessage().PHP_EOL;
});

$server->listen($socket);

if ($config['verbose']) {
    echo 'PHP Twig Render Server listening on '.str_replace('tcp:', 'http:', $socket->getAddress()).PHP_EOL;
}

$loop->run();

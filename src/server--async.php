<?php

use Psr\Http\Message\ServerRequestInterface;
use React\EventLoop\Factory;
use React\Http\Response;
use React\Http\Server;
use React\Promise\Promise;
use BasaltInc\TwigRenderer\TwigRenderer;

require __DIR__ . '/../vendor/autoload.php';

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

try {
  $configString = file_get_contents($configFilePath);
} catch (\Exception $e) {
  $msgs[] = 'No configFile found at: ' . $configFilePath;
  $responseCode = 500;
}

try {
  $config = json_decode($configString, true);
} catch (\Exception $e) {
  $msgs[] = 'Error parsing JSON from config';
  $msgs[] = $e->getMessage();
  $responseCode = 500;
}

$loop = Factory::create();

if ($config) {
  $twigRenderer = new TwigRenderer($config);
//  file_put_contents(__DIR__ . '/info.json', json_encode($twigRenderer->getInfo()));
}

function formatResponseBody($msgs = [], $ok = false, $html = '') {
  return json_encode([
    'ok' => $ok,
    'message' => join(' ', $msgs),
    'html' => $html,
  ]);
}

$server = new Server(function (ServerRequestInterface $request) use (
  $config,
  $twigRenderer,
  &$counter,
  $responseCode,
  $loop
) {
  $headers = [
    'Content-Type' => 'application/json',
    'Access-Control-Allow-Origin' => '*',
  ];
  $msgs = [];
  $counter++;
  $method = $request->getMethod();
  $query = $request->getQueryParams();
  $body = $request->getBody()->getContents();
  try {
    $body = json_decode($body ? $body : '{}', true);
  } catch (\Exception $e) {
    // @todo why doesn't this catch errors from malformed JSON?
    $msgs[] = 'Not able to parse JSON. ' . $e->getMessage();
    return new Response(400, $headers, formatResponseBody($msgs));
  }

  if (!isset($query['type'])) {
    return new Response(
      202,
      $headers,
      json_encode([
        'ok' => true,
        'message' => 'No action correctly requested. Url must have a query param of \'templatePath\' for which twig template to render, but yes - the server is running.',
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
        ])
      );
      break;

    case 'renderFile':
      return new Promise(function ($resolve, $reject) use ($twigRenderer, $query, $body, $headers) {
        $results = $twigRenderer->render($body['template'], $body['data']);
        $response = new Response(
          $results['ok'] ? 200 : 404,
          $headers,
          json_encode($results)
        );
        $resolve($response);
      });
      break;

    case 'renderString':
      return new Promise(function ($resolve, $reject) use ($twigRenderer, $query, $body, $headers) {
        $results = $twigRenderer->renderString($body['template'], $body['data']);
        $response = new Response(
          $results['ok'] ? 200 : 404,
          $headers,
          json_encode($results)
        );
        $resolve($response);
      });
      break;
  }
});

$socket = new \React\Socket\Server($port, $loop);

$server->on('error', function (Exception $e) {
  echo 'PHP TwigRenderer Error: ' . $e->getMessage() . PHP_EOL;
});

$server->listen($socket);

if ($config['verbose']) {
  echo 'PHP Twig Render Server listening on ' . str_replace('tcp:', 'http:', $socket->getAddress()) . PHP_EOL;
}

$loop->run();

<?php

declare(strict_types=1);

namespace App\Core\Middleware;

use App\Core\Service\SeoUrlResolver;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\Views\Twig;

/**
 * Twig şablonlarına dinamik canonical_url ve site_url değişkenlerini enjekte eder.
 */
class SeoViewMiddleware implements MiddlewareInterface
{
    private Twig $twig;
    private SeoUrlResolver $urlResolver;

    public function __construct(Twig $twig, SeoUrlResolver $urlResolver)
    {
        $this->twig = $twig;
        $this->urlResolver = $urlResolver;
    }

    public function process(Request $request, Handler $handler): Response
    {
        $env = $this->twig->getEnvironment();
        $env->addGlobal('site_url', $this->urlResolver->resolveBaseUrl($request));
        $env->addGlobal('canonical_url', $this->urlResolver->resolveCanonicalUrl($request));

        return $handler->handle($request);
    }
}

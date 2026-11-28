<?php

declare(strict_types=1);

namespace App\Core\Service;

use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * İstekten dinamik olarak temel URL ve mutlak canonical URL üretir.
 */
class SeoUrlResolver
{
    public function resolveOrigin(Request $request): string
    {
        $uri = $request->getUri();

        $forwardedProto = $this->firstHeaderValue($request->getHeaderLine('X-Forwarded-Proto'));
        if ($forwardedProto !== '' && in_array(strtolower($forwardedProto), ['http', 'https'], true)) {
            $scheme = strtolower($forwardedProto);
        } elseif ($uri->getScheme() !== '') {
            $scheme = strtolower($uri->getScheme());
        } else {
            $https = $_SERVER['HTTPS'] ?? '';
            $scheme = (!empty($https) && strtolower((string) $https) !== 'off') ? 'https' : 'http';
        }

        $forwardedHost = $this->firstHeaderValue($request->getHeaderLine('X-Forwarded-Host'));
        $hostHeader = $this->firstHeaderValue($request->getHeaderLine('Host'));
        $host = $forwardedHost !== ''
            ? $forwardedHost
            : ($hostHeader !== '' ? $hostHeader : $uri->getHost());

        if ($host === '') {
            $host = (string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost');
        }

        $port = $uri->getPort();
        if ($port !== null && !str_contains($host, ':')) {
            $isDefaultPort = ($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443);
            if (!$isDefaultPort) {
                $host .= ':' . $port;
            }
        }

        return $scheme . '://' . $host;
    }

    public function resolveBaseUrl(Request $request): string
    {
        $origin = $this->resolveOrigin($request);
        $basePath = $this->resolveBasePath();

        return $origin . $basePath;
    }

    public function resolveCanonicalUrl(Request $request): string
    {
        $origin = $this->resolveOrigin($request);
        $path = $request->getUri()->getPath();

        if ($path === '' || $path === '/') {
            return $origin . '/';
        }

        $normalizedPath = '/' . ltrim(rtrim($path, '/'), '/');
        return $origin . $normalizedPath;
    }

    private function resolveBasePath(): string
    {
        $scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
        if ($scriptName !== '' && str_ends_with($scriptName, '/index.php')) {
            $basePath = substr($scriptName, 0, -strlen('/index.php'));
            return rtrim($basePath, '/');
        }

        return '';
    }

    private function firstHeaderValue(string $value): string
    {
        if ($value === '') {
            return '';
        }

        $parts = explode(',', $value);
        return trim($parts[0]);
    }
}

<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\Attributes\Route;
use ReflectionClass;
use ReflectionMethod;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

/**
 * RouteRegistrar - Otomatik Rota Keşfi Motoru
 * 
 * PHP 8 Attributes kullanarak Controller sınıflarını tarar ve
 * rotaları otomatik olarak Slim uygulamasına kaydeder.
 * 
 * Desteklenen Attribute'lar:
 * - #[Group('/prefix')] - Sınıf seviyesinde URL prefix
 * - #[Middleware(Class::class)] - Sınıf/Metod seviyesinde middleware
 * - #[Route('METHOD', '/path')] - Metod seviyesinde rota tanımı
 */
class RouteRegistrar
{
    private App $app;

    public function __construct(App $app)
    {
        $this->app = $app;
    }

    /**
     * Belirtilen dizindeki tüm Controller'ları tarar ve rotaları kaydeder
     * 
     * @param string $namespace Namespace (Şimdilik geriye dönük uyumluluk için var, otomatik tespit ediliyor)
     * @param string $basePath Taranacak dizin
     */
    public function registerFromNamespace(string $namespace, string $basePath): void
    {
        $this->register($basePath);
    }

    /**
     * Belirtilen dizindeki tüm Controller'ları tarar ve rotaları kaydeder
     * 
     * @param string $basePath src/Domain dizininin tam yolu
     */
    public function register(string $basePath): void
    {
        $controllerFiles = $this->discoverControllers($basePath);

        foreach ($controllerFiles as $file) {
            $className = $this->getClassNameFromFile($file, $basePath);

            if ($className && class_exists($className)) {
                $this->registerController($className);
            }
        }
    }

    /**
     * Belirtilen dizinde *Controller.php dosyalarını yinelemeli olarak bulur
     * 
     * @param string $basePath
     * @return array<string> Dosya yolları
     */
    private function discoverControllers(string $basePath): array
    {
        $controllers = [];

        if (!is_dir($basePath)) {
            return $controllers;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && preg_match('/Controller\.php$/', $file->getFilename())) {
                $controllers[] = $file->getPathname();
            }
        }

        return $controllers;
    }

    /**
     * Dosya yolundan namespace dahil sınıf adını çıkarır
     * 
     * @param string $filePath
     * @param string $basePath
     * @return string|null
     */
    private function getClassNameFromFile(string $filePath, string $basePath): ?string
    {
        $content = file_get_contents($filePath);

        // Namespace'i bul
        if (!preg_match('/namespace\s+([^;]+);/', $content, $namespaceMatch)) {
            return null;
        }

        // Sınıf adını bul
        if (!preg_match('/class\s+(\w+)/', $content, $classMatch)) {
            return null;
        }

        return $namespaceMatch[1] . '\\' . $classMatch[1];
    }

    /**
     * Tek bir Controller sınıfını analiz eder ve rotalarını kaydeder
     * 
     * @param string $className
     */
    private function registerController(string $className): void
    {
        $reflectionClass = new ReflectionClass($className);

        // Abstract sınıfları atla (BaseController gibi)
        if ($reflectionClass->isAbstract()) {
            return;
        }

        // Sınıf seviyesinde Group prefix'i al
        $groupPrefix = $this->getGroupPrefix($reflectionClass);

        // Sınıf seviyesinde Middleware'leri al
        $classMiddlewares = $this->getMiddlewares($reflectionClass);

        // Eğer grup prefix varsa, grup içinde rotaları tanımla
        if (!empty($groupPrefix) || !empty($classMiddlewares)) {
            $this->registerGroupedRoutes($reflectionClass, $className, $groupPrefix, $classMiddlewares);
        } else {
            // Grup yoksa direkt rotaları kaydet
            $this->registerDirectRoutes($reflectionClass, $className);
        }
    }

    /**
     * Sınıftan #[Group] attribute'unu okur
     * 
     * @param ReflectionClass $reflectionClass
     * @return string
     */
    private function getGroupPrefix(ReflectionClass $reflectionClass): string
    {
        $attributes = $reflectionClass->getAttributes(Group::class);

        if (empty($attributes)) {
            return '';
        }

        /** @var Group $groupAttribute */
        $groupAttribute = $attributes[0]->newInstance();

        return $groupAttribute->prefix;
    }

    /**
     * Sınıf veya metoddan #[Middleware] attribute'larını okur
     * 
     * @param ReflectionClass|ReflectionMethod $reflection
     * @return array<string> Middleware sınıf adları
     */
    private function getMiddlewares(ReflectionClass|ReflectionMethod $reflection): array
    {
        $middlewares = [];
        $attributes = $reflection->getAttributes(Middleware::class);

        foreach ($attributes as $attribute) {
            /** @var Middleware $middlewareAttribute */
            $middlewareAttribute = $attribute->newInstance();
            $middlewares[] = $middlewareAttribute->className;
        }

        return $middlewares;
    }

    /**
     * Gruplu rotaları kaydeder (prefix ve/veya class-level middleware var)
     * 
     * @param ReflectionClass $reflectionClass
     * @param string $className
     * @param string $groupPrefix
     * @param array $classMiddlewares
     */
    private function registerGroupedRoutes(
        ReflectionClass $reflectionClass,
        string $className,
        string $groupPrefix,
        array $classMiddlewares
    ): void {
        $methods = $reflectionClass->getMethods(ReflectionMethod::IS_PUBLIC);
        $routes = [];

        // Önce tüm rota bilgilerini topla
        foreach ($methods as $method) {
            $routeAttribute = $this->getRouteAttribute($method);

            if ($routeAttribute === null) {
                continue;
            }

            $methodMiddlewares = $this->getMiddlewares($method);

            $routes[] = [
                'httpMethod' => strtoupper($routeAttribute->method),
                'path' => $routeAttribute->path,
                'handler' => $className . ':' . $method->getName(),
                'middlewares' => $methodMiddlewares,
            ];
        }

        // Eğer rota yoksa atla
        if (empty($routes)) {
            return;
        }

        // Slim group ile rotaları kaydet
        $groupPrefix = '/' . ltrim($groupPrefix, '/');
        $group = $this->app->group($groupPrefix, function (RouteCollectorProxy $group) use ($routes) {
            foreach ($routes as $routeInfo) {
                $path = '/' . ltrim($routeInfo['path'], '/');
                $route = $group->map(
                    [$routeInfo['httpMethod']],
                    $path,
                    $routeInfo['handler']
                );

                // Metod seviyesi middleware'leri ekle
                foreach ($routeInfo['middlewares'] as $middleware) {
                    $route->add($middleware);
                }
            }
        });

        // Sınıf seviyesi middleware'leri gruba ekle
        foreach ($classMiddlewares as $middleware) {
            $group->add($middleware);
        }
    }

    /**
     * Direkt rotaları kaydeder (grup ve class-level middleware yok)
     * 
     * @param ReflectionClass $reflectionClass
     * @param string $className
     */
    private function registerDirectRoutes(ReflectionClass $reflectionClass, string $className): void
    {
        $methods = $reflectionClass->getMethods(ReflectionMethod::IS_PUBLIC);

        foreach ($methods as $method) {
            $routeAttribute = $this->getRouteAttribute($method);

            if ($routeAttribute === null) {
                continue;
            }

            $httpMethod = strtoupper($routeAttribute->method);
            $path = '/' . ltrim($routeAttribute->path, '/');
            $handler = $className . ':' . $method->getName();

            $route = $this->app->map([$httpMethod], $path, $handler);

            // Metod seviyesi middleware'leri ekle
            $methodMiddlewares = $this->getMiddlewares($method);
            foreach ($methodMiddlewares as $middleware) {
                $route->add($middleware);
            }
        }
    }

    /**
     * Metoddan #[Route] attribute'unu okur
     * 
     * @param ReflectionMethod $method
     * @return Route|null
     */
    private function getRouteAttribute(ReflectionMethod $method): ?Route
    {
        $attributes = $method->getAttributes(Route::class);

        if (empty($attributes)) {
            return null;
        }

        return $attributes[0]->newInstance();
    }
}

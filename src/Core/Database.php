<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

class Database
{
    private static ?Database $instance = null;
    private PDO $connection;

    private function __construct(array $settings)
    {
        $host = $settings['host'];
        $dbname = $settings['name'];
        $user = $settings['user'];
        $pass = $settings['pass'];
        $charset = $settings['charset'];
        $flags = $settings['flags'];

        $dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";

        try {
            $this->connection = new PDO($dsn, $user, $pass, $flags);
        } catch (PDOException $e) {
            throw new RuntimeException("Database connection failed: " . $e->getMessage());
        }
    }

    public static function getInstance(array $settings = []): self
    {
        if (self::$instance === null) {
            if (empty($settings)) {
                throw new RuntimeException("Database settings are required for the first initialization.");
            }
            self::$instance = new self($settings);
        }

        return self::$instance;
    }

    public function getConnection(): PDO
    {
        return $this->connection;
    }

    public function query(string $sql, array $params = []): \PDOStatement
    {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function fetch(string $sql, array $params = []): array|false
    {
        return $this->query($sql, $params)->fetch();
    }

    public function fetchAll(string $sql, array $params = []): array
    {
        return $this->query($sql, $params)->fetchAll();
    }

    public function beginTransaction(): bool
    {
        return $this->connection->beginTransaction();
    }

    public function commit(): bool
    {
        return $this->connection->commit();
    }

    public function rollBack(): bool
    {
        return $this->connection->rollBack();
    }

    // Prevent cloning
    private function __clone()
    {
    }

    public function lastInsertId(): string|false
    {
        return $this->connection->lastInsertId();
    }

    // Prevent unserializing
    public function __wakeup()
    {
        throw new RuntimeException("Cannot unserialize a singleton.");
    }
}

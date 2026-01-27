<?php

declare(strict_types=1);

namespace App\Core\Service;

class LogReaderService
{
    private string $logPath;

    public function __construct(string $logPath)
    {
        $this->logPath = rtrim($logPath, '/');
    }

    /**
     * Parse log entries from file
     * 
     * @param string $date Date in YYYY-MM-DD format
     * @param string|null $level Log level (INFO, ERROR, etc.)
     * @param string|null $search Search term in message or context
     * @param int $limit Max entries to return
     * @return array
     */
    public function getLogs(string $date, ?string $level = null, ?string $search = null, int $limit = 500): array
    {
        $filename = "app-{$date}.log";
        $filePath = $this->logPath . '/' . $filename;

        if (!file_exists($filePath)) {
            return [];
        }

        $logs = [];
        $handle = fopen($filePath, 'r');
        if ($handle) {
            while (($line = fgets($handle)) !== false) {
                $parsed = $this->parseLogLine($line);
                if ($parsed) {
                    // Filter by level
                    if ($level && $level !== 'ALL' && strcasecmp($parsed['level'], $level) !== 0) {
                        continue;
                    }

                    // Filter by search
                    if ($search && !empty($search)) {
                        if (stripos($line, $search) === false) {
                            continue;
                        }
                    }

                    $logs[] = $parsed;
                }
            }
            fclose($handle);
        }

        // Return latest logs first and limit
        $logs = array_reverse($logs);
        return array_slice($logs, 0, $limit);
    }

    /**
     * Get available log dates by looking at files in logs directory
     * 
     * @return array List of dates in YYYY-MM-DD format
     */
    public function getAvailableDates(): array
    {
        $dates = [];
        $files = glob($this->logPath . '/app-*.log');

        foreach ($files as $file) {
            if (preg_match('/app-(\d{4}-\d{2}-\d{2})\.log$/', $file, $matches)) {
                $dates[] = $matches[1];
            }
        }

        rsort($dates);
        return $dates;
    }

    /**
     * Parse a single log line into an associative array
     */
    private function parseLogLine(string $line): ?array
    {
        // Example: [2026-01-20T14:30:00.123456+03:00] channel.LEVEL: message {context} {extra}
        // This regex looks for: 
        // 1. [timestamp]
        // 2. channel.LEVEL:
        // 3. message (everything until the last two JSON objects or one JSON object)
        $pattern = '/^\[(?<timestamp>.*?)\] (?<channel>.*?)\.(?<level>.*?): (?<message>.*?) (?<context>\{.*?\})(?: (?<extra>\{.*?\})|)$/';

        if (preg_match($pattern, trim($line), $matches)) {
            $context = json_decode($matches['context'], true) ?? [];
            $extra = isset($matches['extra']) ? (json_decode($matches['extra'], true) ?? []) : [];

            return [
                'timestamp' => $matches['timestamp'],
                'level' => $matches['level'],
                'message' => trim($matches['message']),
                'context' => $context,
                'extra' => $extra,
                'raw' => $line
            ];
        }

        return null;
    }
}

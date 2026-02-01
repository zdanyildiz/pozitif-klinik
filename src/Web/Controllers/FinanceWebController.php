<?php

declare(strict_types=1);

namespace App\Web\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;
use App\Domain\Finance\PaymentRepository;
use App\Core\Service\SessionService;
use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;

#[Group('/admin/finance')]
#[Middleware(\App\Web\Middleware\SessionAuthMiddleware::class)]
class FinanceWebController
{
    private Twig $view;
    private PaymentRepository $paymentRepository;
    private SessionService $session;

    public function __construct(Twig $view, PaymentRepository $paymentRepository, SessionService $session)
    {
        $this->view = $view;
        $this->paymentRepository = $paymentRepository;
        $this->session = $session;
    }

    /**
     * Kasa Yönetimi Dashboard
     */
    #[Route('GET', '')]
    public function index(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $today = date('Y-m-d');

        // Özet Veriler
        $summary = $this->paymentRepository->getDailySummary($clinicId, $today);
        $totalToday = $this->paymentRepository->getDailyTotal($clinicId, $today);
        $recentTransactions = $this->paymentRepository->getRecentTransactions($clinicId, 10);
        $pendingPayments = $this->paymentRepository->getPendingPayments($clinicId); // Limit 50

        // İstatistikler: Sadece bugün borçlu sayısı vb. değil global bekleyen
        $pendingCount = count($pendingPayments);
        $pendingTotal = array_reduce($pendingPayments, fn($acc, $item) => $acc + $item['remaining_amount'], 0);

        return $this->view->render($response, 'finance/dashboard.twig', [
            'summary' => $summary,
            'totalToday' => $totalToday,
            'recentTransactions' => $recentTransactions,
            'pendingCount' => $pendingCount,
            'pendingTotal' => $pendingTotal,
            'pageTitle' => 'Kasa ve Finans',
            'page' => 'finance'
        ]);
    }

    /**
     * Borçlu Listesi (Daha detaylı sayfa)
     */
    #[Route('GET', '/pending')]
    public function pending(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $pendingPayments = $this->paymentRepository->getPendingPayments($clinicId);

        return $this->view->render($response, 'finance/pending_payments.twig', [
            'pendingPayments' => $pendingPayments,
            'pageTitle' => 'Bekleyen Ödemeler',
            'page' => 'finance_pending'
        ]);
    }

    /**
     * Tüm İşlemler (Histori)
     */
    #[Route('GET', '/transactions')]
    public function transactions(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        // İleride pagination eklenebilir. Şimdilik son 100 işlem.
        $transactions = $this->paymentRepository->getRecentTransactions($clinicId, 100);

        return $this->view->render($response, 'finance/transactions.twig', [
            'transactions' => $transactions,
            'pageTitle' => 'Kasa Hareketleri',
            'page' => 'finance_transactions'
        ]);
    }
}

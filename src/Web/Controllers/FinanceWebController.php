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
    private \App\Domain\Patient\PatientRepository $patientRepository;
    private SessionService $session;

    public function __construct(
        Twig $view,
        PaymentRepository $paymentRepository,
        \App\Domain\Patient\PatientRepository $patientRepository,
        SessionService $session
    ) {
        $this->view = $view;
        $this->paymentRepository = $paymentRepository;
        $this->patientRepository = $patientRepository;
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

        // Haftalık Trend Analizi
        $thisWeekStart = date('Y-m-d', strtotime('monday this week'));
        $thisWeekEnd = date('Y-m-d', strtotime('sunday this week'));
        $lastWeekStart = date('Y-m-d', strtotime('monday last week'));
        $lastWeekEnd = date('Y-m-d', strtotime('sunday last week'));

        $thisWeekTotal = $this->paymentRepository->getPeriodTotal($clinicId, $thisWeekStart, $thisWeekEnd);
        $lastWeekTotal = $this->paymentRepository->getPeriodTotal($clinicId, $lastWeekStart, $lastWeekEnd);

        $trendPercent = 0;
        if ($lastWeekTotal > 0) {
            $trendPercent = (($thisWeekTotal - $lastWeekTotal) / $lastWeekTotal) * 100;
        } elseif ($thisWeekTotal > 0) {
            $trendPercent = 100; // Önceki hafta 0, bu hafta artış var -> %100 pozitif
        }

        return $this->view->render($response, 'finance/dashboard.twig', [
            'summary' => $summary,
            'totalToday' => $totalToday,
            'recentTransactions' => $recentTransactions,
            'pendingCount' => $pendingCount,
            'pendingTotal' => $pendingTotal,
            // Weekly Stats
            'thisWeekTotal' => $thisWeekTotal,
            'trendPercent' => $trendPercent,

            'pendingPayments' => $pendingPayments,
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
     * Filtreleme ve Pagination eklendi.
     */
    #[Route('GET', '/transactions')]
    public function transactions(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->session->get('clinic_id');
        $queryParams = $request->getQueryParams();

        $page = (int) ($queryParams['page'] ?? 1);
        $perPage = 20;

        $filters = [
            'start_date' => $queryParams['start_date'] ?? null,
            'end_date' => $queryParams['end_date'] ?? null,
            'payment_type' => $queryParams['payment_type'] ?? null,
            'search' => null, // Blind index search bypass
            'patient_id' => $queryParams['patient_id'] ?? null,
            'patient_ids' => []
        ];

        // "q" parametresi varsa arama yap
        if (!empty($queryParams['q'])) {
            $query = trim($queryParams['q']);
            $foundIds = [];

            // 1. Yöntem: Tam Eşleşme (Blind Index)
            $exactMatches = $this->patientRepository->search($clinicId, $query);
            foreach ($exactMatches as $p) {
                $foundIds[] = $p['id'];
            }

            // 2. Yöntem: Eğer tam eşleşme yoksa veya az ise, "Randevu Ekranı Mantığı" ile son 100 hastayı çekip içinde ara
            // Bu, "Sevda" yazınca "Sevda Yılmaz"ı bulmayı sağlar (En azından son eklenenlerde)
            if (empty($foundIds)) {
                $recentPatients = $this->patientRepository->getSelectList($clinicId);
                foreach ($recentPatients as $p) {
                    // Türkçe karakter duyarlı arama için mb_stripos kullanılabilir veya basit stripos
                    if (stripos($p['name'], $query) !== false || stripos($p['tc_no'], $query) !== false) {
                        $foundIds[] = $p['id'];
                    }
                }
            }

            $filters['patient_ids'] = array_unique($foundIds);

            // Eğer hala hiç kimse bulunamadıysa (ne db search ne memory filter), boş küme döndür
            if (empty($filters['patient_ids'])) {
                $filters['patient_ids'] = [-1]; // İmkansız ID
            }
        }

        // Verileri Çek
        $transactions = $this->paymentRepository->getDetailedTransactions($clinicId, $filters, $page, $perPage);
        $totalCount = $this->paymentRepository->countDetailedTransactions($clinicId, $filters);
        $totalPages = ceil($totalCount / $perPage);

        $viewData = [
            'transactions' => $transactions,
            'pageTitle' => 'Kasa Hareketleri',
            'page' => 'finance_transactions',
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'filters' => $queryParams,
            'totalCount' => $totalCount
        ];

        // AJAX Request Kontrolü
        if ($request->getHeaderLine('X-Requested-With') === 'XMLHttpRequest') {
            $html = $this->view->fetch('finance/partials/transaction_rows.twig', $viewData);
            $pagination = $this->view->fetch('finance/partials/pagination.twig', $viewData);

            $payload = json_encode([
                'status' => true,
                'data' => [
                    'html' => $html,
                    'pagination' => $pagination,
                    'totalCount' => $totalCount
                ]
            ]);

            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
        }

        return $this->view->render($response, 'finance/transactions.twig', $viewData);
    }
}

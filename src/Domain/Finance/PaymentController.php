<?php

declare(strict_types=1);

namespace App\Domain\Finance;

use App\Core\Attributes\Route;
use App\Core\Attributes\Group;
use App\Core\Attributes\Middleware;
use App\Core\BaseController;
use App\Middleware\TenantMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Respect\Validation\Validator as v;
use Psr\Container\ContainerInterface;

/**
 * PaymentController - Ödeme ve Tahsilat İşlemleri
 * 
 * Rotalar:
 * - POST    /api/payments             - Yeni tahsilat
 * - GET     /api/payments/report      - Günlük rapor
 * - DELETE  /api/payments/{id}        - Ödeme iptali
 */
#[Group('/api/payments')]
#[Middleware(TenantMiddleware::class)]
class PaymentController extends BaseController
{
    private PaymentRepository $paymentRepository;

    public function __construct(ContainerInterface $container, PaymentRepository $paymentRepository)
    {
        parent::__construct($container);
        $this->paymentRepository = $paymentRepository;
    }

    /**
     * Yeni ödeme/tahsilat oluşturur (Tekli veya Parçalı)
     */
    #[Route('POST', '')]
    public function createPayment(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $data = $request->getParsedBody();
        $userId = $this->getUserId($request);

        // Eğer data['payments'] varsa parçalı ödemedir
        if (isset($data['payments']) && is_array($data['payments'])) {
            foreach ($data['payments'] as &$payment) {
                if (empty($payment['payment_date'])) {
                    $payment['payment_date'] = date('Y-m-d H:i:s');
                }
            }
            $paymentIds = $this->paymentRepository->createMultiple($clinicId, $data['payments'], $userId);

            $this->getLogger($clinicId)->info('Multiple payments received', [
                'count' => count($paymentIds),
                'user_id' => $userId
            ]);

            return $this->createdResponse($response, [
                'ids' => $paymentIds
            ], 'Tahsilatlar başarıyla kaydedildi');
        }

        // Tekli ödeme validasyonu (Mevcut yapı)
        $validator = v::key('patient_id', v::intVal())
            ->key('appointment_id', v::optional(v::intVal()))
            ->key('amount', v::numericVal()->positive())
            ->key('payment_type', v::in(['cash', 'credit_card', 'bank_transfer', 'other']))
            ->key('payment_date', v::optional(v::dateTime()))
            ->key('notes', v::optional(v::stringType()));

        try {
            $validator->assert($data);

            $data['created_by'] = $userId;
            if (empty($data['payment_date'])) {
                $data['payment_date'] = date('Y-m-d H:i:s');
            }

            $paymentId = $this->paymentRepository->create($clinicId, $data);

            $this->getLogger($clinicId)->info('Payment received', [
                'payment_id' => $paymentId,
                'amount' => $data['amount'],
                'user_id' => $userId
            ]);

            return $this->createdResponse($response, [
                'id' => $paymentId
            ], 'Tahsilat başarıyla kaydedildi');

        } catch (\Respect\Validation\Exceptions\NestedValidationException $e) {
            return $this->validationErrorResponse($response, $e->getMessages());
        }
    }

    /**
     * Günlük rapor verisi döner
     */
    #[Route('GET', '/report')]
    public function getReport(Request $request, Response $response): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $date = $request->getQueryParams()['date'] ?? date('Y-m-d');

        $summary = $this->paymentRepository->getDailySummary($clinicId, $date);
        $total = $this->paymentRepository->getDailyTotal($clinicId, $date);

        return $this->success($response, [
            'date' => $date,
            'summary' => $summary,
            'total_turnover' => $total
        ]);
    }

    /**
     * Ödeme iptal eder
     */
    #[Route('DELETE', '/{id:[0-9]+}')]
    public function cancelPayment(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $paymentId = (int) $args['id'];

        $this->paymentRepository->cancel($clinicId, $paymentId);

        $this->getLogger($clinicId)->warning('Payment cancelled', [
            'payment_id' => $paymentId,
            'user_id' => $this->getUserId($request)
        ]);

        return $this->success($response, null, 'Ödeme iptal edildi');
    }

    /**
     * Randevu / İşlem Detayı (Modal için)
     */
    #[Route('GET', '/transaction-detail/{appointmentId:[0-9]+}')]
    public function getTransactionDetails(Request $request, Response $response, array $args): Response
    {
        $clinicId = (int) $this->getClinicId($request);
        $appointmentId = (int) $args['appointmentId'];

        $details = $this->paymentRepository->getTransactionDetailWithServices($clinicId, $appointmentId);

        return $this->success($response, $details);
    }
}

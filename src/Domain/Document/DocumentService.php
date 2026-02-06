<?php

declare(strict_types=1);

namespace App\Domain\Document;

use App\Core\Database;
use App\Core\Security\CryptoService;
use App\Domain\Patient\PatientRepository;
use App\Domain\Examination\ExaminationRepository;
use App\Domain\Lab\LabRepository;
use App\Domain\Platform\TenantRepository;
use Slim\Views\Twig;
use Psr\Log\LoggerInterface;

/**
 * DocumentService - Epikriz ve Doküman Oluşturma İş Mantığı
 * 
 * Controller'da logic yasak prensibine uygun.
 * Veri toplama, şablon render ve PDF oluşturma işlerini yönetir.
 */
class DocumentService
{
    private DocumentRepository $documentRepo;
    private PatientRepository $patientRepo;
    private ExaminationRepository $examRepo;
    private LabRepository $labRepo;
    private TenantRepository $tenantRepo;
    private CryptoService $crypto;
    private Twig $twig;
    private LoggerInterface $logger;
    private Database $db;

    public function __construct(
        DocumentRepository $documentRepo,
        PatientRepository $patientRepo,
        ExaminationRepository $examRepo,
        LabRepository $labRepo,
        TenantRepository $tenantRepo,
        CryptoService $crypto,
        Twig $twig,
        LoggerInterface $logger,
        Database $db
    ) {
        $this->documentRepo = $documentRepo;
        $this->patientRepo = $patientRepo;
        $this->examRepo = $examRepo;
        $this->labRepo = $labRepo;
        $this->tenantRepo = $tenantRepo;
        $this->crypto = $crypto;
        $this->twig = $twig;
        $this->logger = $logger;
        $this->db = $db;
    }

    /**
     * Epikriz için tüm verileri toplar
     */
    public function collectEpicrisisData(int $clinicId, int $examinationId): array
    {
        // 1. Muayene bilgilerini al
        $examination = $this->examRepo->findById($clinicId, $examinationId);
        if (!$examination) {
            throw new \InvalidArgumentException("Muayene kaydı bulunamadı: $examinationId");
        }

        // 2. Hasta bilgilerini al (şifreli veriler çözülür)
        $patient = $this->patientRepo->findById($clinicId, (int) $examination['patient_id']);
        if (!$patient) {
            throw new \InvalidArgumentException("Hasta kaydı bulunamadı: " . $examination['patient_id']);
        }

        // Cinsiyet metni
        $patient['gender_text'] = match ($patient['gender'] ?? '') {
            'M' => 'Erkek',
            'F' => 'Kadın',
            default => 'Belirtilmemiş'
        };

        // 3. Klinik bilgilerini al
        $clinic = $this->tenantRepo->getBasicInfo($clinicId);

        // 4. Lab sonuçlarını al (appointment_id üzerinden)
        $labResults = [];
        if (!empty($examination['appointment_id'])) {
            $allLabs = $this->labRepo->findAllByPatient($clinicId, (int) $examination['patient_id']);
            foreach ($allLabs as $lab) {
                if ((int) ($lab['appointment_id'] ?? 0) === (int) $examination['appointment_id']) {
                    $labResults[] = $lab;
                }
            }
        }

        // 5. Doktor bilgisi
        $doctor = $this->getDoctorInfo((int) ($examination['doctor_user_id'] ?? 0));

        // 6. Muayene tarihini formatla
        $examination['date'] = date('d.m.Y', strtotime($examination['created_at']));

        return [
            'patient' => $patient,
            'examination' => $examination,
            'clinic' => $clinic,
            'lab_results' => $labResults,
            'doctor' => $doctor,
            'diagnoses' => [] // ICD-10 kodları için (ileride eklenebilir)
        ];
    }

    /**
     * Twig şablonunu render eder
     */
    public function renderTemplate(array $template, array $data): string
    {
        // Twig Environment'ı string şablonlarla kullanabilmek için
        $loader = $this->twig->getEnvironment()->getLoader();
        $env = $this->twig->getEnvironment();

        // HTML parçalarını birleştir
        $fullHtml = '';

        // CSS Stilleri
        if (!empty($template['css_styles'])) {
            $fullHtml .= "<style>\n" . $template['css_styles'] . "\n</style>\n";
        }

        // Header
        if (!empty($template['header_html'])) {
            $headerTemplate = $env->createTemplate($template['header_html']);
            $fullHtml .= $headerTemplate->render($data);
        }

        // Ana içerik
        $contentTemplate = $env->createTemplate($template['content_html']);
        $fullHtml .= $contentTemplate->render($data);

        // Footer
        if (!empty($template['footer_html'])) {
            $footerTemplate = $env->createTemplate($template['footer_html']);
            $fullHtml .= $footerTemplate->render($data);
        }

        return $fullHtml;
    }

    /**
     * Epikriz PDF oluşturur
     * 
     * @param int $clinicId
     * @param int $examinationId
     * @param int|null $templateId Şablon ID (null ise varsayılan)
     * @return string PDF binary content
     */
    public function generateEpicrisisPdf(int $clinicId, int $examinationId, ?int $templateId = null): string
    {
        // 1. Şablonu al
        if ($templateId) {
            $template = $this->documentRepo->getTemplateById($templateId);
            if (!$template) {
                throw new \InvalidArgumentException("Şablon bulunamadı: $templateId");
            }
        } else {
            $template = $this->documentRepo->getDefaultTemplate($clinicId, 'epicrisis');
            if (!$template) {
                throw new \RuntimeException("Varsayılan epikriz şablonu bulunamadı.");
            }
        }

        // 2. Verileri topla
        $data = $this->collectEpicrisisData($clinicId, $examinationId);

        // 3. HTML render et
        $html = $this->renderTemplate($template, $data);

        // 4. mPDF ile PDF oluştur
        $pdf = $this->createPdf($template, $html);

        $this->logger->info("Epikriz PDF oluşturuldu", [
            'clinic_id' => $clinicId,
            'examination_id' => $examinationId,
            'template_id' => $template['id']
        ]);

        return $pdf;
    }

    /**
     * Epikriz HTML önizleme oluşturur
     */
    public function generateEpicrisisPreview(int $clinicId, int $examinationId, ?int $templateId = null): string
    {
        // 1. Şablonu al
        if ($templateId) {
            $template = $this->documentRepo->getTemplateById($templateId);
        } else {
            $template = $this->documentRepo->getDefaultTemplate($clinicId, 'epicrisis');
        }

        if (!$template) {
            throw new \RuntimeException("Şablon bulunamadı.");
        }

        // 2. Verileri topla
        $data = $this->collectEpicrisisData($clinicId, $examinationId);

        // 3. HTML render et
        return $this->renderTemplate($template, $data);
    }

    /**
     * mPDF instance oluşturur ve PDF döner
     */
    private function createPdf(array $template, string $html): string
    {
        // mPDF v8.x yapılandırması
        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8',
            'format' => $template['page_format'] ?? 'A4',
            'orientation' => ($template['orientation'] ?? 'portrait') === 'landscape' ? 'L' : 'P',
            'margin_left' => (int) ($template['margin_left'] ?? 15),
            'margin_right' => (int) ($template['margin_right'] ?? 15),
            'margin_top' => (int) ($template['margin_top'] ?? 20),
            'margin_bottom' => (int) ($template['margin_bottom'] ?? 20),
            'margin_header' => 0,
            'margin_footer' => 0,
            'default_font' => 'dejavusans', // Türkçe karakter desteği
            'tempDir' => sys_get_temp_dir() . '/mpdf',
        ]);

        // Türkçe karakter desteği
        $mpdf->autoScriptToLang = true;
        $mpdf->autoLangToFont = true;

        // HTML'i yaz
        $mpdf->WriteHTML($html);

        // PDF çıktısını string olarak al
        return $mpdf->Output('', \Mpdf\Output\Destination::STRING_RETURN);
    }

    /**
     * Doküman oluşturur ve kaydeder
     */
    public function createAndSaveEpicrisis(
        int $clinicId,
        int $examinationId,
        int $userId,
        ?int $templateId = null,
        bool $savePdf = false
    ): array {
        // 1. PDF ve HTML oluştur
        $template = $templateId
            ? $this->documentRepo->getTemplateById($templateId)
            : $this->documentRepo->getDefaultTemplate($clinicId, 'epicrisis');

        $data = $this->collectEpicrisisData($clinicId, $examinationId);
        $html = $this->renderTemplate($template, $data);
        $pdfContent = $this->createPdf($template, $html);

        // 2. Veritabanına kaydet
        $documentData = [
            'clinic_id' => $clinicId,
            'patient_id' => $data['patient']['id'],
            'examination_id' => $examinationId,
            'appointment_id' => $data['examination']['appointment_id'] ?? null,
            'template_id' => $template['id'],
            'document_type' => 'epicrisis',
            'document_title' => 'Epikriz - ' . $data['patient']['name'] . ' - ' . date('d.m.Y'),
            'generated_content' => $html,
            'metadata' => [
                'doctor_id' => $data['examination']['doctor_user_id'],
                'doctor_name' => $data['doctor']['name'] ?? null,
                'diagnosis' => $data['examination']['diagnosis'] ?? null
            ],
            'created_by' => $userId
        ];

        // İsteğe bağlı olarak dosya olarak da kaydet
        // (Bu aşamada sadece DB kaydı yapıyoruz)

        $documentId = $this->documentRepo->saveDocument($documentData);

        return [
            'id' => $documentId,
            'pdf' => $pdfContent,
            'html' => $html
        ];
    }

    /**
     * Doktor bilgisini getirir
     */
    private function getDoctorInfo(int $userId): array
    {
        if ($userId <= 0) {
            return ['name' => 'Belirtilmemiş', 'specialty' => null];
        }

        $sql = "SELECT name, role FROM sys_users WHERE id = ?";
        $user = $this->db->fetch($sql, [$userId]);

        return [
            'name' => $user['name'] ?? 'Belirtilmemiş',
            'specialty' => null // İleride uzmanlık bilgisi eklenebilir
        ];
    }

    /**
     * Kliniğin şablonlarını listeler
     */
    public function getTemplates(int $clinicId, ?string $type = null): array
    {
        return $this->documentRepo->getTemplatesForClinic($clinicId, $type);
    }

    /**
     * Hastanın dokümanlarını listeler
     */
    public function getPatientDocuments(int $clinicId, int $patientId, ?string $type = null): array
    {
        return $this->documentRepo->getDocumentsByPatient($clinicId, $patientId, $type);
    }
}

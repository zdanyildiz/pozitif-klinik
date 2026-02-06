<?php

declare(strict_types=1);

namespace App\Domain\Document;

use App\Core\Database;
use PDO;

/**
 * DocumentRepository - Doküman Şablonları ve Oluşturulan Dokümanlar Veritabanı İşlemleri
 * 
 * Multi-tenant yapıya uygun.
 * Şablonlar: Kliniğe özel veya sistem geneli olabilir.
 * Dokümanlar: Her zaman kliniğe aittir.
 */
class DocumentRepository
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    // ==========================================
    // ŞABLON (TEMPLATE) İŞLEMLERİ
    // ==========================================

    /**
     * Kliniğin kullanabileceği şablonları getirir
     * Önce kliniğe özel, sonra sistem varsayılanları
     */
    public function getTemplatesForClinic(int $clinicId, ?string $type = null): array
    {
        $sql = "SELECT t.*, 
                    CASE WHEN t.clinic_id IS NULL THEN 'Sistem' ELSE 'Özel' END as source
                FROM cln_document_templates t
                WHERE t.is_active = 1 ";

        $params = [];

        if ($clinicId > 0) {
            $sql .= " AND (t.clinic_id = :clinic_id OR t.clinic_id IS NULL)";
            $params['clinic_id'] = $clinicId;
        } else {
            // Sadece sistem şablonları
            $sql .= " AND t.clinic_id IS NULL";
        }

        if ($type) {
            $sql .= " AND t.type = :type";
            $params['type'] = $type;
        }

        $sql .= " ORDER BY t.clinic_id IS NULL ASC, t.sort_order ASC, t.name ASC";

        return $this->db->fetchAll($sql, $params);
    }

    /**
     * Belirli bir türdeki varsayılan şablonu getirir
     * Önce kliniğe özel varsayılan, yoksa sistem varsayılanı
     */
    public function getDefaultTemplate(int $clinicId, string $type = 'epicrisis'): ?array
    {
        // Önce kliniğe özel varsayılan
        $sql = "SELECT * FROM cln_document_templates 
                WHERE clinic_id = :clinic_id 
                  AND type = :type 
                  AND is_default = 1 
                  AND is_active = 1
                LIMIT 1";

        $result = $this->db->fetch($sql, [
            'clinic_id' => $clinicId,
            'type' => $type
        ]);

        if ($result) {
            return $result;
        }

        // Yoksa sistem varsayılanı
        $sql = "SELECT * FROM cln_document_templates 
                WHERE clinic_id IS NULL 
                  AND type = :type 
                  AND is_default = 1 
                  AND is_active = 1
                LIMIT 1";

        return $this->db->fetch($sql, ['type' => $type]) ?: null;
    }

    /**
     * ID'ye göre şablon getirir
     */
    public function getTemplateById(int $id): ?array
    {
        $sql = "SELECT * FROM cln_document_templates WHERE id = ?";
        return $this->db->fetch($sql, [$id]) ?: null;
    }

    /**
     * Kliniğe özel şablon oluşturur
     */
    public function createTemplate(int $clinicId, array $data): int
    {
        $sql = "INSERT INTO cln_document_templates 
                (clinic_id, name, type, content_html, header_html, footer_html, css_styles,
                 page_format, orientation, margin_top, margin_right, margin_bottom, margin_left,
                 is_default, is_active, sort_order)
                VALUES 
                (:clinic_id, :name, :type, :content_html, :header_html, :footer_html, :css_styles,
                 :page_format, :orientation, :margin_top, :margin_right, :margin_bottom, :margin_left,
                 :is_default, :is_active, :sort_order)";

        $this->db->query($sql, [
            'clinic_id' => $clinicId > 0 ? $clinicId : null,
            'name' => $data['name'],
            'type' => $data['type'] ?? 'epicrisis',
            'content_html' => $data['content_html'],
            'header_html' => $data['header_html'] ?? null,
            'footer_html' => $data['footer_html'] ?? null,
            'css_styles' => $data['css_styles'] ?? null,
            'page_format' => $data['page_format'] ?? 'A4',
            'orientation' => $data['orientation'] ?? 'portrait',
            'margin_top' => $data['margin_top'] ?? 20,
            'margin_right' => $data['margin_right'] ?? 15,
            'margin_bottom' => $data['margin_bottom'] ?? 20,
            'margin_left' => $data['margin_left'] ?? 15,
            'is_default' => $data['is_default'] ?? 0,
            'is_active' => $data['is_active'] ?? 1,
            'sort_order' => $data['sort_order'] ?? 0
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Şablon günceller
     */
    public function updateTemplate(int $id, array $data): bool
    {
        $allowedFields = [
            'name',
            'content_html',
            'header_html',
            'footer_html',
            'css_styles',
            'page_format',
            'orientation',
            'margin_top',
            'margin_right',
            'margin_bottom',
            'margin_left',
            'is_default',
            'is_active',
            'sort_order'
        ];

        $updates = [];
        $params = [];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $updates[] = "$field = ?";
                $params[] = $data[$field];
            }
        }

        if (empty($updates)) {
            return false;
        }

        $params[] = $id;
        $sql = "UPDATE cln_document_templates SET " . implode(', ', $updates) . " WHERE id = ?";

        $stmt = $this->db->query($sql, $params);
        return $stmt->rowCount() > 0;
    }

    /**
     * Şablon siler (Sadece kliniğe özel olanlar)
     */
    public function deleteTemplate(int $clinicId, int $id): bool
    {
        if ($clinicId > 0) {
            $sql = "DELETE FROM cln_document_templates WHERE id = ? AND clinic_id = ?";
            $stmt = $this->db->query($sql, [$id, $clinicId]);
        } else {
            // Sistem şablonu sil (clinic_id NULL)
            $sql = "DELETE FROM cln_document_templates WHERE id = ? AND clinic_id IS NULL";
            $stmt = $this->db->query($sql, [$id]);
        }
        return $stmt->rowCount() > 0;
    }

    // ==========================================
    // DOKÜMAN (GENERATED DOCUMENT) İŞLEMLERİ
    // ==========================================

    /**
     * Oluşturulan dokümanı kaydeder
     */
    public function saveDocument(array $data): int
    {
        $sql = "INSERT INTO cln_patient_documents 
                (clinic_id, patient_id, examination_id, appointment_id, template_id,
                 document_type, document_title, generated_content, file_path, file_id, metadata, created_by)
                VALUES 
                (:clinic_id, :patient_id, :examination_id, :appointment_id, :template_id,
                 :document_type, :document_title, :generated_content, :file_path, :file_id, :metadata, :created_by)";

        $this->db->query($sql, [
            'clinic_id' => $data['clinic_id'],
            'patient_id' => $data['patient_id'],
            'examination_id' => $data['examination_id'] ?? null,
            'appointment_id' => $data['appointment_id'] ?? null,
            'template_id' => $data['template_id'] ?? null,
            'document_type' => $data['document_type'] ?? 'epicrisis',
            'document_title' => $data['document_title'] ?? null,
            'generated_content' => $data['generated_content'] ?? null,
            'file_path' => $data['file_path'] ?? null,
            'file_id' => $data['file_id'] ?? null,
            'metadata' => isset($data['metadata']) ? json_encode($data['metadata']) : null,
            'created_by' => $data['created_by']
        ]);

        return (int) $this->db->getConnection()->lastInsertId();
    }

    /**
     * Hastanın oluşturulan dokümanlarını listeler
     */
    public function getDocumentsByPatient(int $clinicId, int $patientId, ?string $type = null): array
    {
        $sql = "SELECT d.*, u.name as created_by_name, t.name as template_name
                FROM cln_patient_documents d
                LEFT JOIN sys_users u ON d.created_by = u.id
                LEFT JOIN cln_document_templates t ON d.template_id = t.id
                WHERE d.clinic_id = :clinic_id AND d.patient_id = :patient_id";

        $params = [
            'clinic_id' => $clinicId,
            'patient_id' => $patientId
        ];

        if ($type) {
            $sql .= " AND d.document_type = :type";
            $params['type'] = $type;
        }

        $sql .= " ORDER BY d.created_at DESC";

        return $this->db->fetchAll($sql, $params);
    }

    /**
     * Muayeneye ait dokümanları listeler
     */
    public function getDocumentsByExamination(int $clinicId, int $examinationId): array
    {
        $sql = "SELECT d.*, u.name as created_by_name, t.name as template_name
                FROM cln_patient_documents d
                LEFT JOIN sys_users u ON d.created_by = u.id
                LEFT JOIN cln_document_templates t ON d.template_id = t.id
                WHERE d.clinic_id = ? AND d.examination_id = ?
                ORDER BY d.created_at DESC";

        return $this->db->fetchAll($sql, [$clinicId, $examinationId]);
    }

    /**
     * Tekil doküman getirir
     */
    public function getDocumentById(int $clinicId, int $id): ?array
    {
        $sql = "SELECT d.*, u.name as created_by_name, t.name as template_name
                FROM cln_patient_documents d
                LEFT JOIN sys_users u ON d.created_by = u.id
                LEFT JOIN cln_document_templates t ON d.template_id = t.id
                WHERE d.clinic_id = ? AND d.id = ?";

        return $this->db->fetch($sql, [$clinicId, $id]) ?: null;
    }

    /**
     * Doküman siler
     */
    public function deleteDocument(int $clinicId, int $id): bool
    {
        $sql = "DELETE FROM cln_patient_documents WHERE clinic_id = ? AND id = ?";
        $stmt = $this->db->query($sql, [$clinicId, $id]);
        return $stmt->rowCount() > 0;
    }
}

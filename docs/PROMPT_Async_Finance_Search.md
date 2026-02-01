# PROMPT: Fix Finance Search by Mimicking Appointment Logic

## Context
The **Finance Module Search** (`/admin/finance/transactions`) is currently failing to return results for partial name queries (e.g., searching "Sevda" finds nothing even if "Sevda Yılmaz" exists) because it relies on `blindIndex` encryption which requires **exact matches**.

However, the **Appointment Module** successfully handles patient searching. We need to implement a similar logic in the Finance Module to ensure the search functionality works as expected for the user (finding patients by name or TC).

**Current Issue:**
- Finance Controller uses `PaymentRepository::getDetailedTransactions` which queries `(p.tc_no_hash = ? OR p.name_hash = ?)` using a blind index.
- Since blind index hashes the *entire* string, partial searches fail.

## Goal
Update the Finance Search logic to correctly find patients even with partial inputs, leveraging the same method or workaround used in other parts of the application (e.g., fetching a list of matching patient IDs first, or using the specific Patient Search endpoint).

## Instructions

### 1. Verification (Step-by-Step)
1.  **Analyze `PatientController::searchPatients`** (`src/Domain/Patient/PatientController.php`):
    *   Confirm how `/api/patients/search` works. Does it use `blindIndex`? If so, does it expect exact matches?
    *   *Note:* If it also uses `blindIndex`, then maybe the user inputs the *full name* in appointments? OR the appointment page loads a list of patients (via `getSelectList` - limit 100) and filters *client-side*?
    *   *CRITICAL:* The user explicitly noted: "Randevu sayfasındaki yeni randevu oluştururken kişi araması nasıl sonuç döndürüyor". If that page uses `TomSelect` with remote data, it might be calling a search API.

2.  **Determine the Best Approach for Finance**:
    *   **Option A (Backend):** Modify `FinanceWebController::transactions` to determining the `patient_ids` first.
        *   Call `PatientRepository::search` (or a new fuzzy search method if exists) with the query `q`.
        *   Get the list of matching `patient_id`s.
        *   Pass these IDs to `PaymentRepository::getDetailedTransactions` (e.g. `WHERE patient_id IN (...)`).
    *   **Option B (Frontend - Hybrid):**
        *   Keep the text input.
        *   On the frontend (`transactions.twig`), when the user types, first call `/api/patients/search?q=...` (if available and returns data).
        *   Then use the IDs from that result to filter the table. (This might be complex for a simple text input without a dropdown).

### 2. Implementation Plan (Preferred: Option A - Backend Fix)
Modify `src/Web/Controllers/FinanceWebController.php` inside the `transactions` method:

1.  **Intercept the `q` (search) parameter.**
2.  **If `q` is present:**
    *   Don't just pass it to `PaymentRepository`.
    *   First, query the `PatientRepository` to find patients matching that name/TC.
        *   *Check:* If `PatientRepository::search` also uses blind index (exact match only), this won't help for partials.
        *   *Workaround:* If no partial search capability exists on the backend (due to encryption), check if we can fallback to `id` search or if we need to decrypt names (expensive).
        *   *Observation:* If `PatientRepository` *only* supports blind index, then the User's claim about Appointment search (if it does partials) implies either:
            a) They use Client-Side search on loaded data.
            b) They have a separate unencrypted search column (unlikely).
            c) They only search by exact TC or Name.

3.  **Refined Plan (If Backend Partial Search is Impossible):**
    *   Since the user wants the input to remain a **Text Input**, but work like the Appointment search:
    *   In `appointments.js`, the code uses `api.get('/api/patients/select-list')` which loads the **last 100 patients**. It then filters them **Client-Side** (TomSelect search).
    *   **Proposal for Finance:**
        *   We cannot easily replicate client-side search behavior in a server-side rendered table with pagination (1000s of transactions) using just a text input *unless* we first resolve the text to IDs.
        *   *If* we must support partial names on backend: We need to see if `PatientRepository` has a `searchLike` method even if slow (decrypt loop?) - probably not allowed/existing.
        *   **Hypothesis:** The Appointment page *only* finds patients in the recent 100 list OR handles exact matches. IF the user says it works, maybe they are testing with recent patients.
        *   **Action:** implement the "Find IDs first" logic in `FinanceWebController`.
            ```php
            // Pseudo Code in FinanceWebController
            if ($filters['search']) {
                 // Try to find patients matching the query 
                 // (Using whatever search method PatientRepository offers)
                 $matchingPatients = $this->patientRepository->search($clinicId, $filters['search']);
                 $patientIds = array_column($matchingPatients, 'id');
                 
                 // If patients found, filter transactions by these IDs
                 if (!empty($patientIds)) {
                     $filters['patient_ids'] = $patientIds;
                     // And remove 'search' filter so PaymentRepo doesn't try to blind-index match it again fails
                     unset($filters['search']);
                 }
            }
            ```

4.  **Update `PaymentRepository`**:
    *   Add support for `patient_ids` (array) filter in `getDetailedTransactions`.

### 3. File Updates
*   `src/Web/Controllers/FinanceWebController.php`
*   `src/Domain/Finance/PaymentRepository.php`

**Validation:**
Ensure searching "Sevda" finds transactions for "Sevda Yılmaz" if `PatientRepository::search` allows it. If `PatientRepository::search` is also exact-match only, then we must report this limitation or implement a valid partial search strategy (e.g. searching by decrypted name in memory if dataset is small, or strictly advising exact matches is the only way).

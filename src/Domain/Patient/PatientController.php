<?php

declare(strict_types=1);

namespace App\Domain\Patient;

use App\Core\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Respect\Validation\Validator as v;

class PatientController extends BaseController
{
    public function listPatients(Request $request, Response $response): Response
    {
        // Placeholder
        return $this->successResponse($response, ['message' => 'List of patients']);
    }

    public function getPatient(Request $request, Response $response, array $args): Response
    {
        $patientId = (int)$args['id'];
        // Placeholder
        return $this->successResponse($response, ['message' => "Details of patient $patientId"]);
    }

    public function createPatient(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        $validator = v::key('first_name', v::stringType()->length(2, 100))
                     ->key('last_name', v::stringType()->length(2, 100))
                     ->key('email', v::email())
                     ->key('phone', v::oneOf(v::nullType(), v::phone()));

        try {
            $validator->assert($data);
            // Placeholder for creation logic
            return $this->createdResponse($response, ['message' => 'Patient created successfully']);
        } catch (\Respect\Validation\Exceptions\NestedValidationException $exception) {
            return $this->validationErrorResponse($response, $exception->getMessages());
        }
    }

    public function updatePatient(Request $request, Response $response, array $args): Response
    {
        $patientId = (int)$args['id'];
        $data = $request->getParsedBody();

        // Placeholder for update logic
        return $this->successResponse($response, ['message' => "Patient $patientId updated successfully"]);
    }

    public function deletePatient(Request $request, Response $response, array $args): Response
    {
        $patientId = (int)$args['id'];
        // Placeholder for delete logic
        return $this->successResponse($response, ['message' => "Patient $patientId deleted successfully"]);
    }
}

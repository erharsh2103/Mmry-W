import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../models/user.js";
import type { CaregiverAccess } from "../models/patient.js";
import { patientsRepository } from "../repositories/patients.repository.js";
import { forbidden, notFound, unauthorized } from "../utils/httpError.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
}

/*
 * Object-level authorisation for every /patients/:patientId route: the caller
 * must be linked to that patient. A patient the caller cannot see is reported
 * as not found, so ids cannot be probed.
 */
export function requirePatientAccess(minimum: CaregiverAccess = "member") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    const patientId = req.params.patientId;
    if (typeof patientId !== "string" || !UUID.test(patientId)) return next(notFound("Patient not found"));
    const access = await patientsRepository.accessFor(patientId, req.auth.sub);
    if (!access) return next(notFound("Patient not found"));
    if (minimum === "owner" && access !== "owner") return next(forbidden("Only the owning caregiver can do this"));
    req.patientAccess = access;
    next();
  };
}

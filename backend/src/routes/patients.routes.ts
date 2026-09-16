import { Router } from "express";
import { activityController, assistantController, insightsController } from "../controllers/activity.controller.js";
import { patientsController, peopleController, routineController } from "../controllers/patients.controller.js";
import { safetyController } from "../controllers/safety.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePatientAccess, requireRole } from "../middleware/authorize.js";
import { pinLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";
import {
  analyticsQuery,
  listQuery,
  recordMindCheckBody,
  recordSessionsBody,
} from "../validators/activity.validators.js";
import { dayQuery } from "../validators/common.js";
import {
  createPatientBody,
  createPersonBody,
  personParams,
  setPinBody,
  setTaskBody,
  taskParams,
  updatePatientBody,
  verifyPinBody,
} from "../validators/patient.validators.js";
import { alertContactBody, alertContactParams, classifyIntentBody, reportFixBody, setHomeBody, updateZoneBody } from "../validators/safety.validators.js";

/* Every route here requires a signed-in caregiver. */
export const patientRoutes = Router();
patientRoutes.use(authenticate);
patientRoutes.use(requireRole("caregiver", "admin"));

patientRoutes.get("/", patientsController.list);
patientRoutes.post("/", validate("body", createPatientBody), patientsController.create);

/* Everything below is scoped to one patient the caller is linked to. */
const one = Router({ mergeParams: true });
one.use(requirePatientAccess());
patientRoutes.use("/:patientId", one);

one.get("/", patientsController.get);
one.patch("/", validate("body", updatePatientBody), patientsController.update);
one.delete("/", requirePatientAccess("owner"), patientsController.remove);
one.put("/pin", requirePatientAccess("owner"), validate("body", setPinBody), patientsController.setPin);
one.post("/pin/verify", pinLimiter, validate("body", verifyPinBody), patientsController.verifyPin);

one.get("/tasks", validate("query", dayQuery), routineController.listTasks);
one.put("/tasks/:taskId", validate("params", taskParams), validate("body", setTaskBody), routineController.setTask);

one.get("/people", peopleController.list);
one.post("/people", validate("body", createPersonBody), peopleController.create);
one.delete("/people/:personId", validate("params", personParams), peopleController.remove);
one.put("/people/:personId/location", validate("params", personParams), peopleController.pinHere);
one.delete("/people/:personId/location", validate("params", personParams), peopleController.clearPin);

one.post("/sessions", validate("body", recordSessionsBody), activityController.recordSessions);
one.get("/sessions", validate("query", listQuery), activityController.listSessions);
one.post("/mind-checks", validate("body", recordMindCheckBody), activityController.recordMindCheck);
one.get("/mind-checks", validate("query", listQuery), activityController.listMindChecks);

one.get("/insights", validate("query", dayQuery), insightsController.get);
one.get("/analytics", validate("query", analyticsQuery), insightsController.analytics);

one.get("/safety", safetyController.state);
one.patch("/safety/zone", validate("body", updateZoneBody), safetyController.updateZone);
one.put("/safety/home", validate("body", setHomeBody), safetyController.setHome);
one.post("/safety/fixes", validate("body", reportFixBody), safetyController.reportFix);
one.post("/safety/sos", safetyController.sos);
one.get("/safety/contacts", safetyController.contacts);
one.post("/safety/contacts", validate("body", alertContactBody), safetyController.addContact);
one.delete("/safety/contacts/:contactId", validate("params", alertContactParams), safetyController.removeContact);

one.post("/assistant/intent", validate("body", classifyIntentBody), assistantController.classify);

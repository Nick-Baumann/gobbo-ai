import AjvPkg, { type ErrorObject } from "ajv";
import {
  type AgentEvent,
  AgentEventSchema,
  AgentParamsSchema,
  ErrorCodes,
  type ErrorShape,
  ErrorShapeSchema,
  type EventFrame,
  EventFrameSchema,
  errorShape,
  type Hello,
  type HelloError,
  HelloErrorSchema,
  type HelloOk,
  HelloOkSchema,
  HelloSchema,
  type PresenceEntry,
  PresenceEntrySchema,
  ProtocolSchemas,
  PROTOCOL_VERSION,
  type RequestFrame,
  RequestFrameSchema,
  type ResponseFrame,
  ResponseFrameSchema,
  SendParamsSchema,
  type Snapshot,
  SnapshotSchema,
  type StateVersion,
  StateVersionSchema,
  TickEventSchema,
  type TickEvent,
  GatewayFrameSchema,
  type GatewayFrame,
  type ShutdownEvent,
  ShutdownEventSchema,
} from "./schema.js";

const ajv = new (
  AjvPkg as unknown as new (
    opts?: object,
  ) => import("ajv").default
)({
  allErrors: true,
  strict: false,
  removeAdditional: false,
});

export const validateHello = ajv.compile<Hello>(HelloSchema);
export const validateRequestFrame =
  ajv.compile<RequestFrame>(RequestFrameSchema);
export const validateSendParams = ajv.compile(SendParamsSchema);
export const validateAgentParams = ajv.compile(AgentParamsSchema);

export function formatValidationErrors(
  errors: ErrorObject[] | null | undefined,
) {
  if (!errors) return "unknown validation error";
  return ajv.errorsText(errors, { separator: "; " });
}

export {
  HelloSchema,
  HelloOkSchema,
  HelloErrorSchema,
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
  GatewayFrameSchema,
  PresenceEntrySchema,
  SnapshotSchema,
  ErrorShapeSchema,
  StateVersionSchema,
  AgentEventSchema,
  SendParamsSchema,
  AgentParamsSchema,
  TickEventSchema,
  ShutdownEventSchema,
  ProtocolSchemas,
  PROTOCOL_VERSION,
  ErrorCodes,
  errorShape,
};

export type {
  GatewayFrame,
  Hello,
  HelloOk,
  HelloError,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  PresenceEntry,
  Snapshot,
  ErrorShape,
  StateVersion,
  AgentEvent,
  TickEvent,
  ShutdownEvent,
};

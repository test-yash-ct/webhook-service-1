import test from "node:test";
import assert from "node:assert";
import { isValidEventType, normalizeInboundEnvelope } from "../src/contracts/events";
import { parseProcessorBody, resolveEventType } from "../src/domain/ingest";

test("processor JSON and YAML bodies parse as data only", () => {
  const json = parseProcessorBody("application/json", '{"type":"payment.captured","payload":{"invoiceId":1}}');
  assert.strictEqual(resolveEventType(json), "payment.captured");
  const yamlBody = parseProcessorBody(
    "application/x-yaml",
    "eventType: payment.captured\nsourceService: billing-service\nrequestId: req-9\npayload:\n  invoiceId: 1\n"
  );
  const envelope = normalizeInboundEnvelope(yamlBody, "fallback");
  assert.ok(envelope);
  assert.strictEqual(envelope?.eventType, "payment.captured");
  assert.strictEqual(envelope?.sourceService, "billing-service");
  assert.strictEqual(envelope?.requestId, "req-9");
});

test("event type format is bounded for the shared contract", () => {
  assert.strictEqual(isValidEventType("payment.captured"), true);
  assert.strictEqual(isValidEventType("unknown"), true);
  assert.strictEqual(isValidEventType(""), false);
  assert.strictEqual(isValidEventType("a".repeat(65)), false);
  assert.strictEqual(isValidEventType("payment captured"), false);
});

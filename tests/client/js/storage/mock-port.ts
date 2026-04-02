/* Shared mock MessagePort factory for storage layer tests.
 *
 * Both the StorageClient tests (client-side) and the storage worker tests
 * (worker-side) need a fake MessagePort backed by EventTarget. This module
 * provides a base factory and two role-specific wrappers:
 *
 * - makeClientMockPort(): simulates a port from the client's perspective,
 *   exposing a `respond` helper that fires incoming worker responses.
 * - makeWorkerMockPort(): simulates a port from the worker's perspective,
 *   exposing a `send` helper that fires incoming client requests.
 */

import { vi, type MockInstance } from 'vitest';
import type {
  StorageRequest,
  StorageResponse,
} from '../../../../src/client/js/storage/adapter';

// The base port shape shared by both client and worker mocks.
interface BaseMockPort {
  port: MessagePort;
  postSpy: ReturnType<typeof vi.fn>;
}

// Client-side mock adds a `respond` helper and includes `dispatchEvent`.
export interface ClientMockPort extends BaseMockPort {
  respond: (data: StorageResponse & { _id?: string }) => void;
}

// Worker-side mock adds a `send` helper and omits `dispatchEvent`.
export interface WorkerMockPort extends BaseMockPort {
  postSpy: MockInstance;
  send: (req: StorageRequest & { _id?: string }) => void;
}

/**
 * Creates a mock MessagePort for client-side tests. The port includes
 * dispatchEvent so StorageClient can fire events internally, and exposes
 * a `respond` helper to simulate incoming worker responses.
 * @return {ClientMockPort} The mock port, postMessage spy, and respond helper
 */
export function makeClientMockPort(): ClientMockPort {
  const target = new EventTarget();
  const postSpy = vi.fn();

  const port = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    postMessage: postSpy,
    start: vi.fn(),
  } as unknown as MessagePort;

  /**
   * Fires a message event on the port, simulating a response from the worker.
   * @param {StorageResponse & { _id?: string }} data - The response payload
   * @return {void}
   */
  function respond(data: StorageResponse & { _id?: string }): void {
    const event = new MessageEvent('message', { data });
    target.dispatchEvent(event);
  }

  return { port, postSpy, respond };
}

/**
 * Creates a mock MessagePort for worker-side tests. The port captures
 * outgoing messages via postSpy and exposes a `send` helper to simulate
 * incoming client requests.
 * @return {WorkerMockPort} The mock port, postMessage spy, and send helper
 */
export function makeWorkerMockPort(): WorkerMockPort {
  const target = new EventTarget();
  const postSpy = vi.fn();

  const port = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    postMessage: postSpy,
    start: vi.fn(),
  } as unknown as MessagePort;

  /**
   * Fires a message event to simulate a client request arriving on the port.
   * @param {StorageRequest & { _id?: string }} req - The request payload
   * @return {void}
   */
  function send(req: StorageRequest & { _id?: string }): void {
    const event = new MessageEvent('message', { data: req });
    target.dispatchEvent(event);
  }

  return { port, postSpy, send };
}

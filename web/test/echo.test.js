import test from 'node:test';
import assert from 'node:assert/strict';
import { isEcho } from '../js/core/echo.js';

test('the app hearing its own voice is ignored, a real reply is not', () => {
  const speaking = 'Warning: this has expired. Please do not take it.';
  assert.ok(isEcho('this has expired please', speaking));
  assert.ok(!isEcho('yes', 'Do you understand the risk?'));
  assert.ok(!isEcho('where is the door', speaking));
  assert.ok(!isEcho('back', ''));
});

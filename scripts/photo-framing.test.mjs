import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhotoFraming, photoFrameRect, isPhotoFraming } from '../photoFraming.ts';

test('framing preserves image proportions and fills the square at every supported zoom', () => {
  for (const aspectRatio of [0.5, 1, 2, 3]) {
    for (const zoom of [1, 1.5, 4]) {
      const frame = normalizePhotoFraming({ aspectRatio, zoom, offsetX: 100, offsetY: -100 });
      const rect = photoFrameRect(frame, 260);
      assert(Math.abs(rect.width / rect.height - aspectRatio) < 1e-8);
      assert(rect.left <= 1e-8 && rect.top <= 1e-8);
      assert(rect.left + rect.width >= 260 - 1e-8);
      assert(rect.top + rect.height >= 260 - 1e-8);
      assert(isPhotoFraming(frame));
      const small = photoFrameRect(frame, 78);
      assert(Math.abs(small.left / 78 - rect.left / 260) < 1e-8);
    }
  }
});

test('invalid framing is rejected and zoom is constrained', () => {
  assert.equal(isPhotoFraming({zoom:NaN,offsetX:0,offsetY:0,aspectRatio:1}),false);
  assert.equal(isPhotoFraming({zoom:2,offsetX:100,offsetY:0,aspectRatio:1}),false);
  assert.equal(normalizePhotoFraming({zoom:0}).zoom,1);
  assert.equal(normalizePhotoFraming({zoom:20}).zoom,4);
});

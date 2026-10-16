// «شوف الطريقة» opens the YouTube app directly on the iPhone (src/youtube.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appLink } from '../src/youtube.js'

test('a youtube.com search becomes the app link, query kept', () => {
  assert.equal(appLink('https://www.youtube.com/results?search_query=Lat+Pulldown+proper+form+shorts'),
    'youtube://www.youtube.com/results?search_query=Lat+Pulldown+proper+form+shorts')
})

test('a watch link, a mobile host and a youtu.be short link', () => {
  assert.equal(appLink('https://m.youtube.com/watch?v=abc123'), 'youtube://www.youtube.com/watch?v=abc123')
  assert.equal(appLink('https://youtu.be/abc123'), 'youtube://www.youtube.com/watch?v=abc123')
  assert.equal(appLink('https://youtu.be/abc123?t=30'), 'youtube://www.youtube.com/watch?v=abc123&t=30')
})

test('anything that is not YouTube is left alone', () => {
  assert.equal(appLink('https://example.com/video'), null)
  assert.equal(appLink('not a url'), null)
  assert.equal(appLink(''), null)
})

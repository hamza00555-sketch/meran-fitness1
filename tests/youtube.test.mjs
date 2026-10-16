// «شوف الطريقة» opens the YouTube app directly on the iPhone (src/youtube.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appLink, shouldFallback } from '../src/youtube.js'

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

test('the web page never opens once the YouTube app took over', () => {
  // no app: the page stayed in front, the timer on time
  assert.equal(shouldFallback({ left: false, elapsed: 1500, visible: true }), true)
  // the app opened: hidden, blurred or put away
  assert.equal(shouldFallback({ left: true, elapsed: 1500, visible: true }), false)
  // iOS froze the timer while YouTube was in front: it fires on his return
  assert.equal(shouldFallback({ left: false, elapsed: 60000, visible: true }), false)
  assert.equal(shouldFallback({ left: false, elapsed: 1500, visible: false }), false)
})

// The agent that runs inside a preview served from its own origin.
//
// A cross-origin iframe's document is unreachable: `contentDocument` is null,
// and `webSecurity: false` does not change that, because site isolation puts
// the frame in another process. So the canvas stops reaching in and starts
// asking, and something inside the page answers.
//
// The script is built by serialising the functions in framePick rather than
// by writing them out again. Two copies of a selector rule would drift, and
// the drift would show up as the wrong element being picked in an app and the
// right one in a design, with nothing on screen to say why.
//
// The protocol is deliberately small. Everything the canvas does to a page is
// one of: mark the modes, pick an element, read the tokens, set a token, set
// a style, set some text, collect what changed, count the slides, or move the
// scroll. Anything larger belongs in the page, not in a message.

import {
  classifyToken, computeSelector, readProjectTokens, readStyles,
  type ElementStyles, type ProjectToken
} from './framePick'

/** What the canvas asks the page to do. */
export type FrameRequest =
  | { id: number; kind: 'modes'; annotate: boolean; edit: boolean }
  | { id: number; kind: 'tokens' }
  | { id: number; kind: 'setToken'; name: string; value: string }
  | { id: number; kind: 'setStyle'; selector: string; prop: string; value: string }
  | { id: number; kind: 'setText'; selector: string; text: string }
  | { id: number; kind: 'changes' }
  | { id: number; kind: 'slides' }
  | { id: number; kind: 'scrollBy'; x: number }
  | { id: number; kind: 'scrollY' }
  | { id: number; kind: 'scrollTo'; y: number }

/** What comes back, and what the page says without being asked. */
export type FrameReply =
  | { t42: 'ready' }
  | { t42: 'pick'; selector: string; tag: string; text: string; styles: ElementStyles; html: string }
  | { t42: 'scrolled'; slide: number }
  | { t42: 'reply'; id: number; value: unknown }

export type SlideState = { count: number; index: number }
export type EditChange = { selector: string; text: string; style: string }

/** The channel name, on both sides, so a typo cannot make them disagree. */
export const FRAME_CHANNEL = 't42-frame'

/**
 * The agent, as source.
 *
 * Written as one string rather than a module because it is injected into a
 * page that has no bundler and no imports. The serialised helpers are pasted
 * in above the loop that uses them.
 */
export function agentSource(): string {
  return [
    '(function () {',
    '  if (window.__t42agent) return;',
    '  window.__t42agent = true;',
    `  var computeSelector = ${computeSelector.toString()};`,
    `  var readStyles = ${readStyles.toString()};`,
    `  var classifyToken = ${classifyToken.toString()};`,
    `  var readProjectTokens = ${readProjectTokens.toString()};`,
    AGENT_BODY,
    '})();'
  ].join('\n')
}

/**
 * The loop itself.
 *
 * Kept out of `agentSource` as a plain string so the serialised helpers can
 * be spliced above it, and so this text is never touched by the bundler —
 * a minifier that renamed `computeSelector` here would break the join.
 */
const AGENT_BODY = `
  var post = function (msg) {
    try { parent.postMessage(Object.assign({ channel: '${FRAME_CHANNEL}' }, msg), '*'); } catch (e) {}
  };

  var find = function (selector) {
    var el = document.querySelector('.t42-selected');
    if (el) return el;
    try { return document.querySelector(selector); } catch (e) { return null; }
  };

  var mark = function (el) {
    var was = document.querySelectorAll('.t42-selected');
    for (var i = 0; i < was.length; i++) was[i].classList.remove('t42-selected');
    if (el) el.classList.add('t42-selected');
  };

  var slides = function () {
    var all = document.querySelectorAll('section.slide, .slide, [data-slide], body > section');
    if (!all.length) return { count: 0, index: 0 };
    var deck = document.querySelector('main.deck, .deck');
    var scroller = deck && deck.scrollWidth > deck.clientWidth
      ? deck
      : (document.body.scrollWidth > document.body.clientWidth ? document.body : document.documentElement);
    var width = all[0].getBoundingClientRect().width || scroller.clientWidth || 1;
    return { count: all.length, index: Math.round(scroller.scrollLeft / width) };
  };

  var scroller = function () {
    var deck = document.querySelector('main.deck, .deck');
    if (deck && deck.scrollWidth > deck.clientWidth) return deck;
    if (document.body.scrollWidth > document.body.clientWidth) return document.body;
    return document.documentElement;
  };

  document.addEventListener('click', function (e) {
    var root = document.documentElement;
    if (!root.classList.contains('t42-anno') && !root.classList.contains('t42-edit')) return;
    var el = e.target;
    if (!el || el === root || el === document.body) return;
    e.preventDefault();
    e.stopPropagation();
    if (root.classList.contains('t42-edit')) mark(el);
    var shown = el.innerText !== undefined ? el.innerText : el.textContent;
    post({
      t42: 'pick',
      selector: computeSelector(el),
      tag: el.tagName.toLowerCase(),
      text: (shown || '').trim().slice(0, 120),
      styles: readStyles(el),
      html: el.outerHTML.slice(0, 1000)
    });
  }, true);

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || typeof m !== 'object' || m.channel !== '${FRAME_CHANNEL}') return;
    var value = null;
    try {
      if (m.kind === 'modes') {
        document.documentElement.classList.toggle('t42-anno', !!m.annotate);
        document.documentElement.classList.toggle('t42-edit', !!m.edit);
        if (!m.edit) mark(null);
      } else if (m.kind === 'tokens') {
        value = readProjectTokens(document, classifyToken);
      } else if (m.kind === 'setToken') {
        document.documentElement.style.setProperty(m.name, m.value);
      } else if (m.kind === 'setStyle') {
        var el = find(m.selector);
        if (el) el.style.setProperty(m.prop, m.value);
      } else if (m.kind === 'setText') {
        var t = find(m.selector);
        if (t) t.innerText = m.text;
      } else if (m.kind === 'changes') {
        var out = [];
        var styled = document.querySelectorAll('[style]');
        for (var i = 0; i < styled.length; i++) {
          var s = styled[i].getAttribute('style') || '';
          if (!s.trim()) continue;
          var shown2 = styled[i].innerText !== undefined ? styled[i].innerText : styled[i].textContent;
          out.push({
            selector: computeSelector(styled[i]),
            text: (shown2 || '').trim().slice(0, 80),
            style: s
          });
        }
        value = out;
      } else if (m.kind === 'slides') {
        value = slides();
      } else if (m.kind === 'scrollBy') {
        scroller().scrollBy({ left: m.x, behavior: 'smooth' });
      } else if (m.kind === 'scrollY') {
        value = window.scrollY;
      } else if (m.kind === 'scrollTo') {
        window.scrollTo(0, m.y);
      }
    } catch (err) {
      value = null;
    }
    post({ t42: 'reply', id: m.id, value: value });
  });

  var announce = function () {
    var s = slides();
    post({ t42: 'scrolled', slide: s.index });
  };
  window.addEventListener('scroll', announce, { passive: true });
  document.body && document.body.addEventListener('scroll', announce, { passive: true });

  // Said on every load, not only the first: the canvas may have been waiting
  // since before this document existed, and a listener that only ever hears
  // the first page is the bug the old handshake had.
  post({ t42: 'ready' });
`

/** The one line that puts the agent into a document being served. */
export function withAgent(html: string): string {
  const tag = `<script>${agentSource()}</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}</html>`)
  return html + tag
}

export type { ElementStyles, ProjectToken }

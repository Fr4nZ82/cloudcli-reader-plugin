// DOM-based bridge to inject the submit payload into CloudCLI's Chat tab
// and send it to the currently-selected session, without relying on the
// clipboard. Works because plugins run in the same JS context as the host
// page (no iframe), so DOM access is available.
//
// This is fragile by nature — if CloudCLI changes its DOM structure the
// probe heuristics may break. Caller should fall back to clipboard on
// failure.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  return true;
}

/** Click whichever tab button has the literal text "Chat". */
function switchToChatTab(): boolean {
  const candidates = document.querySelectorAll<HTMLElement>(
    'button, [role="tab"], [role="button"], a'
  );
  for (const el of candidates) {
    const text = (el.textContent || '').trim().toLowerCase();
    if (text === 'chat' && isVisible(el)) {
      el.click();
      return true;
    }
  }
  return false;
}

/**
 * Find the chat input textarea. Heuristics:
 *  1. Visible textareas with a chat-related placeholder.
 *  2. Largest visible textarea on the page (fallback).
 */
function findChatInput(): HTMLTextAreaElement | null {
  const textareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea'));
  const visible = textareas.filter((ta) => isVisible(ta));
  if (visible.length === 0) return null;

  const PH_HINTS = [
    'message', 'messaggio', 'claude', 'cursor', 'codex',
    'ask', 'chiedi', 'type your', 'send a message', 'invia un messaggio',
    'chat', 'prompt',
  ];
  for (const ta of visible) {
    const ph = (ta.placeholder || '').toLowerCase();
    if (PH_HINTS.some((hint) => ph.includes(hint))) {
      return ta;
    }
  }

  // Largest visible textarea as fallback
  let best = visible[0];
  let bestArea = best.getBoundingClientRect().width * best.getBoundingClientRect().height;
  for (const ta of visible) {
    const r = ta.getBoundingClientRect();
    const a = r.width * r.height;
    if (a > bestArea) {
      best = ta;
      bestArea = a;
    }
  }
  return best;
}

/**
 * Set an input/textarea value in a React-friendly way: bypass React's setter
 * cache by calling the native prototype setter, then dispatch input/change
 * events so React syncs its internal state.
 */
function setReactValue(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Find the "send" button associated with the chat input. Heuristics:
 *  1. Buttons near the textarea (same form, or sibling)
 *  2. Buttons with aria-label containing "send"/"invia"
 *  3. Buttons containing an svg/icon with hint text
 */
function findSendButton(input: HTMLTextAreaElement): HTMLButtonElement | null {
  // Look in the same form first
  const form = input.closest('form');
  if (form) {
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit && isVisible(submit) && !submit.disabled) return submit;
  }

  // Look at siblings of the input or its parents up to a few levels
  let container: HTMLElement | null = input.parentElement;
  for (let i = 0; i < 5 && container; i++) {
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    for (const btn of buttons) {
      if (!isVisible(btn) || btn.disabled) continue;
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = (btn.textContent || '').trim().toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      if (aria.includes('send') || aria.includes('invia') ||
          text === 'send' || text === 'invia' ||
          title.includes('send') || title.includes('invia')) {
        return btn;
      }
    }
    container = container.parentElement;
  }
  return null;
}

/** Dispatch a synthetic Enter keypress on the input. */
function pressEnter(el: HTMLElement): void {
  const init: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keypress', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

export interface SendResult {
  ok: boolean;
  /** True if we managed to inject the payload into the input but couldn't confirm submission. */
  injectedOnly?: boolean;
  reason?: string;
}

export async function sendPayloadToChat(payload: string): Promise<SendResult> {
  try {
    // 1) Make sure the Chat tab is active so its DOM is mounted
    const switched = switchToChatTab();
    await sleep(switched ? 400 : 120);

    // 2) Locate the chat input
    let input = findChatInput();
    // Retry once after a small delay (React render may not be settled yet)
    if (!input) {
      await sleep(250);
      input = findChatInput();
    }
    if (!input) {
      return { ok: false, reason: 'chat_input_not_found' };
    }

    // 3) Inject the payload
    input.focus();
    setReactValue(input, payload);
    await sleep(80);

    // 4) Try to click a send button if we can find one (most reliable)
    const sendBtn = findSendButton(input);
    if (sendBtn) {
      sendBtn.click();
      return { ok: true };
    }

    // 5) Otherwise simulate Enter
    pressEnter(input);
    // We can't easily verify whether the host accepted the Enter; report
    // success but mark as injectedOnly so the caller can soften the toast.
    return { ok: true, injectedOnly: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message || 'unknown_error' };
  }
}

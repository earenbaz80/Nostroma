/**
 * Stable anchors for the browser probes.
 *
 * These are the classes, routes and roles the app already renders. A probe
 * should use one of them instead of matching translated copy: the copy is the
 * thing under test, and it changes with the language.
 */
export const anchors = {
  onboarding: {
    root: '.guided-onboarding',
    // The small "go straight to the app" link in the welcome footer.
    skip: '[data-onboard="skip"]',
    // The "finish later" control in every later step's header.
    later: '[data-onboard="later"]',
  },
  navigation: {
    root: 'aside.nav',
    compactOpen: '.mobile-bar button:first-of-type',
    newChat: 'aside.nav .nav-new',
  },
  toast: {
    region: '.st-toasts',
    item: '.st-toasts .st-toast',
  },
  chat: {
    // The model name button in the message box's bar, and the service row in its menu.
    modelPicker: '.chat-model-picker',
    modelPickerApi: '.model-picker-api',
    // The agents button under the conversation, beside the context reading; its title carries the running count.
    agents: '.chat-agents',
  },
  composer: {
    // The message box, and the + that opens its attach menu.
    textarea: '.composer textarea',
    add: '.composer-add',
  },
  telemetry: {
    all: '.telemetry__chip',
    // One chip of the strip: speed, tokens or context.
    chip: name => `[data-telemetry="${name}"]`,
  },
  skills: {
    // A field of the New/Edit skill dialog, by its own name instead of its place on the panel.
    field: name => `[data-skill-field="${name}"]`,
  },
  subagents: {
    // One helper row in the Subagents popover, by its id.
    row: id => `[data-subagent="${id}"]`,
  },
  approval: {
    // The dock above the message box; its `data-count` is how many cards wait there.
    dock: '.approvaldock',
  },
  serving: {
    overview: '.serving-overview',
    apiBaseUrl: '.serving-overview .summary-list > div:first-child',
    copyApiBaseUrl: '.serving-overview .summary-list > div:first-child button',
  },
  tools: {
    // A tool call in the transcript, whichever shape it has: the card while it runs, the summary once it is done.
    card: '[data-tool]',
    live: '[data-tool-card="live"]',
    summary: '[data-tool-card="summary"]',
    proposed: '[data-tool-card="live"][data-state="proposed"]',
    named: name => `[data-tool="${name}"]`,
    // A field of the Add/Edit tool dialog, by its own name instead of its translated label.
    field: field => `[data-tool-field="${field}"]`,
  },
  model: {
    versionCards: '[data-version]',
    version: id => `[data-version="${id}"]`,
  },
};

/** Leave first-run setup when it is showing, without depending on its copy. */
export async function skipOnboarding(page, { timeout = 5000, settle = 800 } = {}) {
  const root = page.locator(anchors.onboarding.root);
  await root.waitFor({ state: 'visible', timeout }).catch(() => {});
  if (!(await root.count())) return;
  const skip = page.locator(anchors.onboarding.skip);
  const control = (await skip.count()) ? skip : page.locator(anchors.onboarding.later);
  if (await control.count()) {
    await control.click();
    await page.waitForTimeout(settle);
  }
}

/* The phone templates preserve the approved design; server snapshots own all shared data. */
export function mountPhone(root, bridge) {
  let snapshot,
    groups = [],
    pending = [],
    charges = [],
    people = [],
    invites = [],
    busy = false,
    disposed = false,
    initialized = false;
  const listeners = new AbortController();
  const on = (type, listener, options = {}) =>
    root.addEventListener(type, listener, {
      ...options,
      signal: listeners.signal,
    });
  /* Icons: Feather — https://github.com/feathericons/feather
The MIT License (MIT)
Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
  const ICONS = {
    home: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    grid: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    "bar-chart-2":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    "arrow-left":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    "arrow-right":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    "chevron-right":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    "chevron-left":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    "chevron-down":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    bell: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    plus: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    users:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    "shopping-bag":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    coffee:
      '<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    music:
      '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    truck:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    "credit-card":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    settings:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    "dollar-sign":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    sliders:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    check:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    lock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    unlock:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
    "arrow-up-right":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>',
    "arrow-down-left":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>',
    calendar:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    "log-out":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    "help-circle":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    "check-circle":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    "more-horizontal":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    "file-text":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    search:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    mail: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    "arrow-up":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    "arrow-down":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    "pie-chart":
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
    shield:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  const $ = (s, scope = root) => scope.querySelector(s);
  const esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const icon = (n) =>
    (ICONS[n] || ICONS["grid"]).replace(
      "<svg ",
      '<svg aria-hidden="true" focusable="false" ',
    );
  const money = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  // Buying power is spendable card funds; existing pending split charges are already debited.

  const state = {
    tab: "home",
    stack: [],
    scroll: {},
    approved: {},
    proposals: {},
    publishedMethods: {},
    methods: {},
    editingCustom: {},
    draftAmounts: {},
    receiptOpen: {},
    month: new Date().getMonth(),
    hidden: new Set(),
    groupHidden: {},
    filter: "all",
    frozen: {},
    autofill: {},
    single: {},
    notice: true,
    displayName: "",
    invites: {},
    groupDraft: null,
    modal: null,
    carousel: {},
    paymentResult: null,
    paymentSequence: 0,
    photoDraft: null,
    splitDrafts: {},
    proposalDetails: {},
    draftSequence: 0,
    memberFocus: {},
    memberMonth: {},
    splitUnits: {},
    selectionDrafts: {},
    itemConfirmations: {},
  };
  let toastTimer;
  const gById = (id) => groups.find((g) => g.id === id) || groups[0];
  // Only submitted allocations change the current share; draft editors never publish by navigation.
  const chargePeople = (c) => {
    if (!c.people)
      c.people = (
        gById(c.group).people ||
        people.slice(0, c.members || gById(c.group).members)
      ).map((p, i) => ({ ...p, id: p.id || "member-" + i }));
    return c.people.map((p, i) => ({ ...p, id: p.id || "member-" + i }));
  };
  const equalAllocation = (total, count) => {
    const cents = Math.round(total * 100),
      base = Math.floor(cents / count);
    return Array.from(
      { length: count },
      (_, i) => (base + (i < cents % count ? 1 : 0)) / 100,
    );
  };
  const currentAllocation = (c) => state.proposals[c.id] || c.allocation || [];
  function canonicalAllocation(c, weights) {
    const people = chargePeople(c),
      ids = c.canonicalMemberIds || people.map((p) => p.id),
      byId = Object.fromEntries(people.map((p, i) => [p.id, weights[i] || 0])),
      parts = distributeWeighted(
        Math.round(c.total * 100),
        ids.map((id) => byId[id] || 0),
      ),
      amounts = Object.fromEntries(ids.map((id, i) => [id, parts[i] / 100]));
    return people.map((p) => amounts[p.id] || 0);
  }
  function equalChargeAllocation(
    c,
    participants = chargePeople(c).map((p) => p.id),
  ) {
    return canonicalAllocation(
      c,
      chargePeople(c).map((p) => (participants.includes(p.id) ? 1 : 0)),
    );
  }
  const currentPersonalAllocation = (c) => currentAllocation(c)[0];
  const currentApprovalCount = (c) => c.approvedBy?.length || 0;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const methodName = (method) =>
    ({ equal: "Equally", item: "By item", custom: "Custom" })[method];

  function currentProposal(c) {
    return (
      state.proposalDetails[c.id] || {
        method: state.publishedMethods[c.id] || c.initialMethod || "equal",
        allocation: currentAllocation(c),
        items: [],
        tax: 0,
        tip: 0,
        receipt: null,
      }
    );
  }

  function moneyCents(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    const text = String(value).trim();
    if (
      !text ||
      (typeof value === "string" &&
        !/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text))
    )
      return null;
    const number = Number(value);
    return Number.isFinite(number) &&
      number >= 0 &&
      Math.abs(number * 100 - Math.round(number * 100)) < 0.00001
      ? Math.round(number * 100)
      : null;
  }
  function distributeWeighted(cents, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (!total) return weights.map(() => 0);
    const values = weights.map((w) => Math.floor((cents * w) / total));
    const order = weights
      .map((w, i) => ({ i, remainder: (cents * w) % total }))
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    for (
      let i = 0, left = cents - values.reduce((a, b) => a + b, 0);
      i < left;
      i++
    )
      values[order[i].i]++;
    return values;
  }
  const splitUnit = (c) => state.splitUnits[c.id] || "dollars";
  function percentageParts(allocation) {
    const cents = allocation.map(moneyCents);
    return cents.some((n) => n === null) || !cents.some((n) => n > 0)
      ? null
      : distributeWeighted(10000, cents);
  }
  const percentText = (basis) => String(Number((basis / 100).toFixed(2)));
  function percentageBasis(value) {
    const text = String(value).trim();
    if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) && number >= 0 && number <= 100
      ? Math.round(number * 100)
      : null;
  }
  function makePercentageDraft(allocation) {
    const baseline = percentageParts(allocation);
    return baseline
      ? {
          values: baseline.map(percentText),
          baseline,
          allocation: [...allocation],
        }
      : null;
  }
  function percentageAllocation(c, draft) {
    const parts = draft.values.map(percentageBasis);
    if (
      parts.length !== chargePeople(c).length ||
      parts.some((n) => n === null)
    )
      return {
        error:
          "Enter a percentage from 0 to 100, with up to two decimal places, for every member.",
      };
    if (parts.reduce((a, b) => a + b, 0) !== 10000)
      return { error: "Member percentages must add up to exactly 100%." };
    return {
      allocation: parts.every((value, i) => value === draft.baseline[i])
        ? [...draft.allocation]
        : canonicalAllocation(c, parts),
    };
  }
  function allocationText(c, allocation, index) {
    if (splitUnit(c) === "dollars") return money(allocation[index]);
    const parts = percentageParts(allocation);
    return parts ? percentText(parts[index]) + "%" : "—";
  }
  function setSplitUnit(id, unit) {
    const c = pending.find((c) => c.id === id);
    if (!c || !["dollars", "percent"].includes(unit) || splitUnit(c) === unit)
      return false;
    const d = current().type === "split-edit" ? state.splitDrafts[id] : null;
    if (d?.method === "custom") {
      const result = calculateProposal(c, d);
      if (result.error) {
        toast(result.error);
        return false;
      }
      d.allocation = [...result.allocation];
      delete d.percentageDraft;
      if (unit === "percent")
        d.percentageDraft = makePercentageDraft(d.allocation);
    }
    state.splitUnits[id] = unit;
    saveScroll();
    render();
    return true;
  }
  function setDraftMethod(c, method) {
    const d = state.splitDrafts[c.id];
    if (!d || d.method === method) return;
    const previous = calculateProposal(c, d);
    d.method = method;
    delete d.percentageDraft;
    if (method === "equal")
      d.participants = [
        ...(c.canonicalMemberIds || chargePeople(c).map((p) => p.id)),
      ];
    if (method === "custom") {
      const full =
        previous.allocation &&
        previous.allocation.reduce((sum, n) => sum + Math.round(n * 100), 0) ===
          Math.round(c.total * 100);
      d.allocation = full ? [...previous.allocation] : equalChargeAllocation(c);
      if (splitUnit(c) === "percent")
        d.percentageDraft = makePercentageDraft(d.allocation);
      if (!full) toast("Custom starts with equal shares of the full bill.");
    }
    saveScroll();
    render();
  }
  function validateItemList(c, p) {
    const members = chargePeople(c),
      tax = moneyCents(p.tax),
      tip = moneyCents(p.tip);
    if (!p.items.length)
      return { error: "Add items before confirming the list." };
    if (tax === null || tip === null)
      return {
        error:
          "Enter valid tax and tip amounts with at most two decimal places.",
      };
    const seen = new Set();
    let subtotal = 0;
    for (const item of p.items) {
      const amount = moneyCents(item.amount);
      if (!item.id || seen.has(item.id))
        return { error: "Every item needs its own identity." };
      seen.add(item.id);
      if (!item.name.trim() || amount === null || amount <= 0)
        return {
          error:
            "Complete the name and positive amount for item " + seen.size + ".",
          incompleteItem: true,
        };
      if (
        !Array.isArray(item.assignees) ||
        item.assignees.length > 1 ||
        item.assignees.some((id) => !members.some((person) => person.id === id))
      )
        return { error: "Each item may belong to at most one group member." };
      subtotal += amount;
    }
    if (subtotal + tax + tip !== Math.round(c.total * 100))
      return {
        error:
          "Items, tax and tip must total " +
          money(c.total) +
          ". Currently " +
          money((subtotal + tax + tip) / 100) +
          ".",
      };
    return { subtotal, tax, tip };
  }
  function itemBreakdown(c, p) {
    const valid = validateItemList(c, p);
    if (valid.error) return valid;
    const members = chargePeople(c),
      weights = p.items.map((item) => moneyCents(item.amount)),
      taxes = distributeWeighted(valid.tax, weights),
      tips = distributeWeighted(valid.tip, weights);
    const buckets = [
      ...members.map((person) => ({
        id: person.id,
        person,
        items: [],
        subtotal: 0,
        tax: 0,
        tip: 0,
        total: 0,
      })),
      { id: null, items: [], subtotal: 0, tax: 0, tip: 0, total: 0 },
    ];
    const items = p.items.map((item, index) => {
      const row = {
        ...item,
        owner: item.assignees[0] || null,
        subtotal: weights[index],
        tax: taxes[index],
        tip: tips[index],
        total: weights[index] + taxes[index] + tips[index],
      };
      const bucket = buckets.find((bucket) => bucket.id === row.owner);
      bucket.items.push(row);
      for (const key of ["subtotal", "tax", "tip", "total"])
        bucket[key] += row[key];
      return row;
    });
    return {
      items,
      buckets,
      allocation: buckets.slice(0, -1).map((bucket) => bucket.total / 100),
      unclaimed: buckets.at(-1).total / 100,
      subtotal: valid.subtotal / 100,
      tax: valid.tax / 100,
      tip: valid.tip / 100,
    };
  }
  function calculateProposal(c, p) {
    const members = chargePeople(c),
      total = Math.round(c.total * 100);
    if (p.method === "item") return itemBreakdown(c, p);
    if (p.method === "equal") {
      const participants = p.participants || members.map((member) => member.id);
      if (
        !participants.length ||
        participants.some((id) => !members.some((member) => member.id === id))
      )
        return { error: "Choose group members for the equal split." };
      return { allocation: equalChargeAllocation(c, participants) };
    }
    if (p.method === "custom") {
      if (p.percentageDraft) return percentageAllocation(c, p.percentageDraft);
      const cents = p.allocation.map(moneyCents);
      if (
        cents.length !== members.length ||
        cents.some((n) => n === null) ||
        cents.reduce((a, b) => a + b, 0) !== total
      )
        return {
          error: "Member shares must add up exactly to " + money(c.total) + ".",
        };
      return { allocation: cents.map((n) => n / 100) };
    }
    return { error: "Choose a split method." };
  }
  function itemListSignature(p) {
    return JSON.stringify({
      method: p.method,
      receipt: p.receipt,
      items: p.items.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        amount: moneyCents(item.amount),
      })),
      tax: moneyCents(p.tax),
      tip: moneyCents(p.tip),
    });
  }

  function prepareSelection(id) {
    const c = pending.find((charge) => charge.id === id),
      p = currentProposal(c),
      result = itemBreakdown(c, p);
    if (p.method !== "item" || result.error) {
      toast(result.error || "Confirm an item list first.");
      return false;
    }
    const self = chargePeople(c)[0].id;
    state.selectionDrafts[id] = {
      ids: p.items
        .filter((item) => item.assignees[0] === self)
        .map((item) => item.id),
      signature: itemListSignature(p),
      receiptKey: c.receiptListKey,
    };
    return true;
  }
  function beginSelection(id) {
    if (!prepareSelection(id)) return false;
    push("select-items", id);
    return true;
  }
  function advanceItemSelection(id) {
    const c = pending.find((charge) => charge.id === id),
      signature = itemListSignature(currentProposal(c));
    if (
      (state.selectionDrafts[id]?.signature !== signature ||
        state.selectionDrafts[id]?.receiptKey !== c.receiptListKey) &&
      !prepareSelection(id)
    )
      return false;
    saveScroll();
    delete state.splitDrafts[id];
    const parent = state.stack.at(-2);
    if (parent?.type === "select-items" && parent.id === id) state.stack.pop();
    else state.stack[state.stack.length - 1] = { type: "select-items", id };
    render();
    return true;
  }
  function finishSplitEdit(id) {
    back();
    if (current().type === "select-items" && current().id === id) back();
  }
  function toggleSelection(id, itemId) {
    const c = pending.find((charge) => charge.id === id),
      draft = state.selectionDrafts[id],
      item = currentProposal(c).items.find((item) => item.id === itemId),
      self = chargePeople(c)[0].id;
    if (
      !draft ||
      !item ||
      (item.assignees.length && item.assignees[0] !== self)
    )
      return false;
    draft.ids = draft.ids.includes(itemId)
      ? draft.ids.filter((id) => id !== itemId)
      : [...draft.ids, itemId];
    saveScroll();
    render();
    return true;
  }

  function beginSplitEdit(id) {
    const c = pending.find((c) => c.id === id),
      published = currentProposal(c),
      draft = {
        ...clone(published),
        allocation: [...currentAllocation(c)],
        generation: ++state.draftSequence,
        editKey: c.editKey,
        manualEntry: published.items.length > 0,
      };
    if (published.receiptDraftDetails) {
      Object.assign(draft, clone(published.receiptDraftDetails));
      draft.manualEntry = true;
    }
    if (draft.method === "item" && !published.exclusive)
      draft.items = draft.items.map((item) => ({ ...item, assignees: [] }));
    if (
      c.preferredSplit === "items" &&
      published.method === "equal" &&
      !published.items.length
    )
      draft.method = "item";
    if (draft.method === "item") draft.exclusive = true;
    draft.receiptDraft = false;
    state.splitDrafts[id] = draft;
    if (draft.method === "custom" && splitUnit(c) === "percent")
      draft.percentageDraft = makePercentageDraft(draft.allocation);
    push("split-edit", id);
  }

  const groupPhotos = {
    apartment: "/phone-assets/apartment.jpg",
    weekend: "/phone-assets/weekend.jpg",
    roadtrip: "/phone-assets/roadtrip.jpg",
  };
  const groupPhoto = (g) => g.photo || groupPhotos[g.id];
  const stamp = (g, size = "") =>
    `<span class="group-icon ${g.tone} ${size} ${groupPhoto(g) ? "has-photo" : ""}">${groupPhoto(g) ? `<img src="${esc(groupPhoto(g))}" alt="" loading="lazy" decoding="async">` : icon(g.icon)}</span>`;
  const merchantLogoKeys = {
    spotify: "spotify",
    wholefoods: "wholefoods",
    ikea: "ikea",
    bluebottle: "bluebottle",
    groceries: "traderjoes",
    shell: "shell",
    costco: "costco",
  };
  const merchantKey = (c) =>
    merchantLogoKeys[c.id] ||
    {
      spotify: "spotify",
      "whole foods": "wholefoods",
      ikea: "ikea",
      "blue bottle": "bluebottle",
      "trader joe’s": "traderjoes",
      "trader joe's": "traderjoes",
      shell: "shell",
      costco: "costco",
    }[String(c.merchant || c.name).toLowerCase()];
  const merchantMark = (c, large = false) => {
    const key = merchantKey(c);
    return `<span class="merchant-mark ${large ? "large" : ""} ${key || "generic"}" aria-hidden="true">${key ? `<img src="/phone-assets/logo-${key}.${key === "wholefoods" ? "png" : "svg"}" alt="">` : icon(c.icon || "shopping-bag")}</span>`;
  };
  const button = (label, action, extra = "", type = "") =>
    `<button type="button" class="button ${type}" data-action="${action}" ${extra}>${label}</button>`;
  const backbar = (title, right = "") =>
    `<header class="backbar"><button class="icon-btn" data-action="back" aria-label="Go back">${icon("arrow-left")}</button><strong>${esc(title)}</strong>${right || '<span class="spacer"></span>'}</header>`;
  const avatar = (p = people[0], large = false) =>
    `<span class="avatar ${p.tone} ${large ? "large" : ""}">${esc(p.initials)}</span>`;
  function toast(message) {
    clearTimeout(toastTimer);
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("visible");
    toastTimer = setTimeout(() => el.classList.remove("visible"), 4200);
  }
  function current() {
    return state.stack.at(-1) || { type: state.tab };
  }
  function routeKey() {
    const r = current();
    return r.type + ":" + (r.id || "");
  }
  function saveScroll() {
    const s = $(".screen");
    if (s) state.scroll[routeKey()] = s.scrollTop;
  }
  function push(type, id) {
    saveScroll();
    state.stack.push({ type, id });
    render(true);
  }
  function back() {
    saveScroll();
    const route = current();
    if (route.type === "split-edit") delete state.splitDrafts[route.id];
    if (route.type === "select-items") delete state.selectionDrafts[route.id];
    state.stack.pop();
    safeRender();
  }
  function nav(tab) {
    if (!state.stack.length && state.tab === tab) return;
    const tabs = ["home", "groups", "spending"],
      direction = state.stack.length
        ? 0
        : Math.sign(tabs.indexOf(tab) - tabs.indexOf(state.tab));
    saveScroll();
    state.splitDrafts = {};
    state.selectionDrafts = {};
    state.stack = [];
    state.tab = tab;
    render(false, { tabDirection: direction });
  }
  function navBar() {
    return `<nav class="bottom-nav" aria-label="Main navigation">${[
      ["home", "home", "Home"],
      ["groups", "grid", "Groups"],
      ["spending", "bar-chart-2", "Spending"],
    ]
      .map(
        ([id, i, t]) =>
          `<button class="nav-button ${state.tab === id ? "active" : ""}" data-action="tab" data-tab="${id}" ${state.tab === id ? 'aria-current="page"' : ""}><span class="nav-icon">${icon(i)}</span>${t}</button>`,
      )
      .join("")}</nav>`;
  }
  function rootHeader() {
    return `<header class="topbar root-header"><button class="icon-btn profile-trigger" data-action="profile" aria-label="Open your profile">${avatar()}</button><span class="header-brand"><img src="/phone-assets/chipin-mark.png" alt="" aria-hidden="true"><span>chipin</span></span><button class="icon-btn" data-action="notifications" aria-label="Open notifications">${icon("bell")}${state.notice ? '<span class="notification-dot"></span>' : ""}</button></header>`;
  }
  function pendingCard(c) {
    const g = gById(c.group);
    return `<button class="pending-card" data-action="split" data-id="${c.id}" aria-label="Review ${esc(c.name)}, your share ${money(currentPersonalAllocation(c))}, ${esc(g.name)}${state.approved[c.id] ? ", accepted and waiting for others" : ""}"><div class="pending-main">${merchantMark(c, true)}<div class="pending-copy"><div class="pending-title">${esc(c.name)} · ${esc(g.name)}${state.approved[c.id] ? " · Waiting" : ""}</div><div class="pending-amount">${money(currentPersonalAllocation(c))}</div></div></div><div class="group-stamp">${stamp(g)}</div></button>`;
  }
  function groupActions() {
    const count = invites.filter((i) => !state.invites[i.id]).length;
    return `<div class="actions-pair groups-actions">${button(icon("plus") + " Create a group", "create", "", "secondary")}${button('<span class="tiny-badge">' + count + "</span><span>Invitations</span>" + icon("mail"), "invitations", `aria-label="${count} invitations to review"`, "secondary invitations-action")}</div>`;
  }

  function allPending() {
    return `${backbar("")}<h1 class="page-title charges-title">Pending charges</h1><div class="pending-list">${pending.map(pendingCard).join("")}</div>`;
  }
  function groupSummaryStatus(g) {
    const count = g.pendingCount;
    const status = g.frozenReason
      ? "Group frozen"
      : g.forming
        ? "Waiting for members"
        : state.frozen[g.id]
          ? "Card frozen"
          : count === 0
            ? "All settled"
            : "";
    return {
      count,
      status,
      text: [
        count ? count + " pending split" + (count === 1 ? "" : "s") : "",
        status,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }
  function groupSummaryCard(g) {
    const activity = groupSummaryStatus(g);
    return `<button class="group-summary" data-action="group" data-id="${g.id}" aria-label="${esc(g.name)}, ${g.members} members, ${money(g.power)} available, ${esc(activity.text)}"><div class="group-summary-heading">${stamp(g, "summary-photo")}<div><h2>${esc(g.name)}</h2><p>${g.members} member${g.members === 1 ? "" : "s"}</p></div>${icon("chevron-right")}</div><div class="group-summary-amount"><strong>${money(g.power)}</strong><span>available</span></div><p class="group-summary-activity">${esc(activity.text)}</p></button>`;
  }
  function groupsPage() {
    return `${rootHeader()}<div class="groups-page-heading"><div><h1 class="page-title">Your groups</h1><p class="eyebrow">Better together, everyday.</p></div></div>${groupActions()}<div class="groups-stack">${groups.map(groupSummaryCard).join("")}</div>`;
  }
  function cardVisual(g) {
    return `<div class="bank-card ${state.frozen[g.id] ? "frozen" : ""}" role="img" aria-label="${esc(g.name)} simulated virtual card ending ${esc(g.last4 || "••••")}${state.frozen[g.id] ? ", frozen" : ""}"><div class="bank-top"><span>chipin<span style="color:#7a9eff">.</span></span>${icon(state.frozen[g.id] ? "lock" : "credit-card")}</div><div class="bank-chip"></div><div class="bank-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; ${esc(g.last4 || "••••")}</div><div class="bank-bottom"><span>${esc(state.fullName.toUpperCase())}<br><span style="font-size:8px;display:block;margin-top:5px;color:#8397b7">${esc(g.name.toUpperCase())}</span></span><strong>VISA</strong></div></div>`;
  }

  function groupCarousel(g) {
    const panel = state.carousel[g.id] || 0;
    return `<div class="group-carousel" data-carousel="${g.id}" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Group card and spending. Use left or right arrow to switch."><div class="carousel-track" style="transform:translateX(-${panel * 50}%)"><div class="carousel-panel" ${panel === 1 ? "inert" : ""}><button class="card-launch" data-action="wallet" data-id="${g.id}" aria-label="Open simulated wallet for ${esc(g.name)}">${cardVisual(g)}</button></div><div class="carousel-panel" ${panel === 0 ? "inert" : ""}>${groupSpendPanel(g)}</div></div></div><div class="carousel-controls" aria-label="Choose card or spending">${["Card", "Spending"].map((name, i) => `<button data-action="carousel" data-id="${g.id}" data-panel="${i}" aria-label="Show ${name.toLowerCase()}" aria-pressed="${panel === i}"><span class="carousel-dot" aria-hidden="true"></span></button>`).join("")}</div>`;
  }
  function setCarousel(id, panel) {
    state.carousel[id] = Number(panel);
    const carousel = root.querySelector('[data-carousel="' + id + '"]');
    if (!carousel) return;
    carousel.querySelector(".carousel-track").style.transform =
      "translateX(-" + panel * 50 + "%)";
    carousel
      .querySelectorAll(".carousel-panel")
      .forEach((el, i) => (el.inert = i !== Number(panel)));
    root
      .querySelectorAll('[data-action="carousel"][data-id="' + id + '"]')
      .forEach((el, i) =>
        el.setAttribute("aria-pressed", String(i === Number(panel))),
      );
  }
  function groupDetail(id) {
    const g = gById(id);
    return `${backbar("Group overview", `<button class="icon-btn" data-action="group-menu" data-id="${id}" data-menu="settings" aria-label="Group settings">${icon("settings")}</button>`)}<div class="group-identity">${stamp(g, "overview-photo")}<h1>${esc(g.name)}</h1></div>${groupCarousel(g)}<div class="fund-metrics"><div><small>Group buying power</small><div class="big">${money(g.power)}</div></div><div><small>Your balance</small><strong>${money(g.balance)}</strong></div></div>${g.forming ? '<div class="callout">' + icon("info") + "<span>This group activates after all invitations are resolved and at least two people join. Contributions collect automatically after each member approves the final amount.</span></div>" : ""}<div class="list-menu">${[
      ["funds", "dollar-sign", "Funds", "Add or withdraw"],
      ["card", "credit-card", "Card controls", "Details and freeze card"],
    ]
      .map(
        ([m, i, t, detail]) =>
          `<button class="menu-row" data-action="group-menu" data-id="${id}" data-menu="${m}">${icon(i)}<span class="menu-copy">${t}<small>${detail}</small></span>${icon("chevron-right")}</button>`,
      )
      .join(
        "",
      )}</div><section class="group-inline-history"><div class="section-heading"><h2>Charge history</h2></div>${groupHistoryRows(id)}</section>`;
  }
  const colors = {
    apartment: "#2459e8",
    weekend: "#b57439",
    roadtrip: "#8a70bd",
  };
  const monthCharges = (month) =>
    charges.filter(
      (c) => c.month === month && c.year === snapshot.calendar.year,
    );
  const spendingTotal = (month, groupId) =>
    monthCharges(month)
      .filter((c) => !groupId || c.group === groupId)
      .reduce((sum, c) => sum + Math.round(c.amount * 100), 0) / 100;

  function groupMembers(g) {
    if (!g.people)
      g.people = people.slice(0, g.members).map((person) => ({ ...person }));
    g.people.forEach((person, index) => {
      person.id ||= "member-" + index;
    });
    return g.people;
  }
  const memberColors = [
    "#2459e8",
    "#b57439",
    "#8a70bd",
    "#17794c",
    "#b44870",
    "#52798b",
    "#9c701e",
    "#6459a3",
  ];
  const settledGroupTotal = (month, id) =>
    monthCharges(month)
      .filter((c) => c.group === id)
      .reduce((sum, c) => sum + Math.round(c.groupAmount * 100), 0) / 100;
  const memberSpendingTotal = (month, id, memberId) =>
    monthCharges(month)
      .filter((c) => c.group === id)
      .reduce(
        (sum, c) => sum + Math.round((c.memberShares[memberId] || 0) * 100),
        0,
      ) / 100;

  function memberLabel(person) {
    return person.id === snapshot.viewer.id
      ? state.displayName + " (you)"
      : person.name;
  }

  function chargeRow(c) {
    return `<button class="charge-row ${c.isPending ? "is-pending" : ""}" data-action="${c.isPending ? "split" : "charge"}" data-id="${c.id}" aria-label="${esc(c.name)}, ${c.isPending ? "pending, current share " + money(currentPersonalAllocation(c)) : "settled, " + money(c.amount)}, ${esc(gById(c.group).name)}">${merchantMark(c, true)}<span class="charge-copy"><strong>${esc(c.name)}</strong><small>${esc(gById(c.group).name)} · ${c.date}</small></span><span class="charge-price">${money(c.isPending ? currentPersonalAllocation(c) : c.amount)}<small>${c.isPending ? "Pending" : "Settled"}</small></span></button>`;
  }
  function groupHistoryRows(id, month = null) {
    const rows = [
      ...pending
        .filter((c) => c.group === id && (month === null || c.month === month))
        .map((c) => ({ ...c, isPending: true })),
      ...(month === null ? charges : monthCharges(month)).filter(
        (c) => c.group === id,
      ),
    ];
    return rows.length
      ? rows.map(chargeRow).join("")
      : `<div class="empty"><p>${month === null ? "No purchases in this group yet." : "No purchases in this month."}</p></div>`;
  }
  function chargeHistory(id) {
    const g = gById(id);
    return `${backbar("Charge history")}<h1 class="page-title">${esc(g.name)}</h1><p class="page-sub">Pending and settled purchases</p>${groupHistoryRows(id)}`;
  }
  function splitSummary(c, share = currentPersonalAllocation(c)) {
    return `<div class="split-summary"><div class="split-pin-content"><h1>Your share</h1><div class="share" id="split-share">${money(share)}</div></div></div><div class="split-summary-details"><p class="split-summary-context">of ${money(c.total)} · ${esc(gById(c.group).name)}</p>${current().type !== "select-items" && currentProposal(c).method === "item" && currentProposal(c).items.length && !state.itemConfirmations[c.id]?.[chargePeople(c)[0].id] ? '<p class="item-selection-prompt">Select your items to calculate your share.</p>' : ""}</div>`;
  }
  const customAllocationValue = (p, index, percent) =>
    percent
      ? (p.percentageDraft?.values[index] ?? "")
      : typeof p.allocation[index] === "number"
        ? p.allocation[index].toFixed(2)
        : p.allocation[index];
  const customInputWidth = (value) =>
    Math.max(
      1,
      [...String(value)].reduce(
        (width, char) => width + (char === "." ? 0.45 : 1),
        0,
      ),
    ) + "ch";
  function proposalHeading(c, title = "Proposed split") {
    return `<div class="proposal-heading"><h2>${title}</h2><div class="split-unit-toggle" role="group" aria-label="Display allocations in dollars or percent">${[
      ["dollars", "$"],
      ["percent", "%"],
    ]
      .map(
        ([unit, label]) =>
          `<button data-action="split-unit" data-id="${c.id}" data-unit="${unit}" aria-label="Show ${unit === "dollars" ? "dollars" : "percentages"}" aria-pressed="${splitUnit(c) === unit}">${label}</button>`,
      )
      .join("")}</div></div>`;
  }
  function groupedItems(c, p, asProposal = true) {
    if (!p.exclusive) {
      const allocation = currentAllocation(c);
      return `<section class="card-section grouped-items">${asProposal ? proposalHeading(c) : "<h2>Receipt items</h2>"}${chargePeople(
        c,
      )
        .map(
          (person, index) =>
            `<div class="person-row">${avatar(person)}<div class="person-info"><strong>${esc(person.name)}${index === 0 ? " (you)" : ""}</strong><small>${p.acceptedBy?.includes(person.id) ? "Selection confirmed" : "Waiting to review"}</small></div><span class="amount">${allocationText(c, allocation, index)}</span></div>`,
        )
        .join(
          "",
        )}<p class="info-text">Make changes and confirm the item list to select items individually.</p></section>`;
    }
    const result = itemBreakdown(c, p);
    if (result.error)
      return asProposal
        ? `<section class="card-section">${proposalHeading(c)}<p class="info-text">Confirm an item list, then everyone selects what they had.</p></section>`
        : "";
    const percentages = distributeWeighted(
      10000,
      result.buckets.map((bucket) => bucket.total),
    );
    return `<section class="card-section grouped-items">${asProposal ? proposalHeading(c) : '<h2>Receipt items</h2><p class="ownership-caption">Item totals below are separate from the ' + methodName(p.method).toLowerCase() + " split above.</p>"}${result.buckets.map((bucket, index) => (!bucket.items.length && !state.itemConfirmations[c.id]?.[bucket.id] ? "" : `<section class="item-owner-group"><div class="person-row">${bucket.person ? avatar(bucket.person) : '<span class="unclaimed-avatar">' + icon("shopping-bag") + "</span>"}<div class="person-info"><strong>${bucket.person ? (index === 0 ? esc(state.displayName) + " (you)" : esc(bucket.person.name)) : "Unclaimed"}</strong><small>${bucket.person ? (state.itemConfirmations[c.id]?.[bucket.id] ? "Selection confirmed" : "Not selected yet") : "Waiting for someone to select"}</small></div><span class="amount">${asProposal && splitUnit(c) === "percent" ? percentText(percentages[index]) + "%" : money(bucket.total / 100)}</span></div>${bucket.items.length ? bucket.items.map((item) => `<div class="owned-item"><span>1× ${esc(item.name)}</span><strong>${money(item.subtotal / 100)}</strong></div>`).join("") : '<p class="no-owned-items">No items</p>'}${bucket.items.length ? `<div class="item-cost-line"><span>Subtotal</span><span>${money(bucket.subtotal / 100)}</span></div><div class="item-cost-line"><span>Tax</span><span>${money(bucket.tax / 100)}</span></div><div class="item-cost-line"><span>Tip</span><span>${money(bucket.tip / 100)}</span></div>` : ""}</section>`)).join("")}</section>`;
  }
  function selectItems(id) {
    const c = pending.find((charge) => charge.id === id),
      p = currentProposal(c),
      draft = state.selectionDrafts[id],
      result = itemBreakdown(c, p),
      members = chargePeople(c),
      self = members[0].id;
    if (result.error || !draft)
      return `${backbar("Select your items")}<p class="info-text">${esc(result.error || "Open the latest item selection.")}</p>`;
    const selected = result.items.filter((item) => draft.ids.includes(item.id)),
      totals = selected.reduce(
        (sum, item) => ({
          subtotal: sum.subtotal + item.subtotal,
          tax: sum.tax + item.tax,
          tip: sum.tip + item.tip,
          total: sum.total + item.total,
        }),
        { subtotal: 0, tax: 0, tip: 0, total: 0 },
      );
    const card = `<section class="card-section item-selection"><div class="row item-card-heading"><h2>Select your items</h2>${button("Edit items", "begin-edit", `data-id="${id}"`, "text-action")}</div><div class="selection-items">${result.items
      .map((item) => {
        const unavailable = !!item.owner && item.owner !== self,
          checked = draft.ids.includes(item.id),
          owner = members.find((person) => person.id === item.owner);
        return `<button class="selection-item ${checked ? "selected" : ""}" data-action="toggle-selection" data-id="${id}" data-item="${item.id}" aria-pressed="${checked}" ${unavailable ? "disabled" : ""}><span class="selection-check">${checked ? icon("check") : ""}</span><span class="selection-copy"><strong>1× ${esc(item.name)}</strong>${unavailable ? `<small>Selected by ${esc(owner.name)}</small>` : ""}</span><strong>${money(item.subtotal / 100)}</strong></button>`;
      })
      .join(
        "",
      )}</div><div class="selection-totals"><h2>Your selection</h2><div class="item-cost-line"><span>${selected.length} ${selected.length === 1 ? "item" : "items"}</span><span>${money(totals.subtotal / 100)}</span></div><div class="item-cost-line"><span>Tax</span><span>${money(totals.tax / 100)}</span></div><div class="item-cost-line"><span>Tip</span><span>${money(totals.tip / 100)}</span></div><div class="row selection-total"><strong>Your share</strong><strong>${money(totals.total / 100)}</strong></div></div></section>`;
    return itemFlowShell(c, p, card, true, totals.total / 100);
  }
  function memberAllocations(c, p, editing = false) {
    if (p.method === "item")
      return editing
        ? `<section class="card-section">${proposalHeading(c)}<div class="row"><span class="row-label">Total to split</span><strong>${splitUnit(c) === "percent" ? "100%" : money(c.total)}</strong></div></section>`
        : groupedItems(c, p);
    const result = editing
        ? calculateProposal(c, p)
        : { allocation: currentAllocation(c) },
      members = chargePeople(c),
      percent = splitUnit(c) === "percent";
    if (editing && p.method === "custom" && percent && !p.percentageDraft)
      p.percentageDraft = makePercentageDraft(p.allocation);
    return `<section class="card-section">${proposalHeading(c)}${editing ? "" : `<p class="proposal-method">${methodName(p.method)}</p>`}${members.map((person, i) => `<div class="person-row">${avatar(person)}<div class="person-info"><strong>${i === 0 ? esc(state.displayName) + " (you)" : esc(person.name)}</strong>${editing ? "" : `<small>${c.approvedBy?.includes(person.id) ? "Accepted" : "Waiting to review"}</small>`}</div>${editing && p.method === "custom" ? `<label class="custom-allocation">${percent ? "" : '<span aria-hidden="true">$</span>'}<input class="custom-input" aria-label="${esc(person.name)} share in ${percent ? "percent" : "dollars"}" inputmode="decimal" type="text" autocomplete="off" spellcheck="false" value="${esc(customAllocationValue(p, i, percent))}" style="width:${customInputWidth(customAllocationValue(p, i, percent))}" data-draft-field="${percent ? "percentage" : "allocation"}" data-person="${i}">${percent ? '<span aria-hidden="true">%</span>' : ""}</label>` : `<span class="amount" data-draft-share="${i}">${result.error ? "—" : allocationText(c, result.allocation, i)}</span>`}</div>`).join("")}</section>`;
  }
  function receiptReview(c, p) {
    const owned =
      p.method !== "item" && p.items.length ? groupedItems(c, p, false) : "";
    if (!p.receipt?.image)
      return owned + '<p class="receipt-missing">No receipt attached</p>';
    return `${owned}<section class="card-section"><button class="receipt-title" data-action="receipt" data-id="${c.id}" aria-expanded="${!!state.receiptOpen[c.id]}"><span>${icon("file-text")} Receipt image</span>${icon(state.receiptOpen[c.id] ? "chevron-down" : "chevron-right")}</button>${state.receiptOpen[c.id] ? `<img class="receipt-photo" src="${esc(p.receipt.image)}" alt="Attached receipt reference">` : ""}</section>`;
  }
  function split(id) {
    const c = pending.find((c) => c.id === id),
      p = currentProposal(c),
      invalid = p.method === "item" ? calculateProposal(c, p).error : null;
    return `${backbar(c.name)}${splitSummary(c)}<div class="split-meta">${icon("users")} ${currentApprovalCount(c)} of ${chargePeople(c).length} approved</div>${invalid ? `<div class="callout neutral">${icon("file-text")}<span>${esc(invalid)}</span></div>` : ""}${state.approved[id] ? '<div class="status-banner">' + icon("check-circle") + "<span>You accepted your " + (p.method === "item" ? "items" : "share") + ". Other members still review for themselves. This purchase remains pending.</span></div>" : ""}${memberAllocations(c, p)}${receiptReview(c, p)}`;
  }
  function receiptEntryActions(c, d) {
    return `<div class="receipt-entry-actions"><label class="button secondary receipt-upload-action">${icon("plus")} ${d.receipt?.image ? "Replace receipt" : "Upload receipt"}<input id="receipt-upload" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>${button(d.manualEntry ? "Add item" : "Enter items", "add-item", `data-id="${c.id}"`, "secondary")}</div>`;
  }
  function itemEditor(c, d) {
    return `<section class="card-section item-editor"><div class="row"><h2>${d.method === "item" ? "Item list" : "Receipt & items"}</h2>${d.receipt?.image ? '<span class="pill">Attached</span>' : ""}</div>${!d.receipt ? `<div class="receipt-empty edit-receipt-empty">${icon("file-text")}<h2>Add your items</h2><p class="info-text receipt-add-prompt">Upload a receipt for reference, or enter the items below.</p>${receiptEntryActions(c, d)}</div>` : `${d.receipt.image ? `<img class="receipt-photo" src="${esc(d.receipt.image)}" alt="Draft receipt reference">` : ""}${receiptEntryActions(c, d)}`}${d.manualEntry ? button("Use sample items", "sample-items", `data-id="${c.id}"`, "receipt-sample") : ""}${d.items.map((item, index) => `<article class="item-draft"><div class="item-draft-fields"><input class="item-name-input" aria-label="Item ${index + 1} name" placeholder="Item name" value="${esc(item.name)}" maxlength="60" data-draft-field="item-name" data-item="${item.id}"><label class="custom-allocation"><span aria-hidden="true">$</span><input class="custom-input item-money-input" placeholder="0.00" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Item ${index + 1} amount in dollars" value="${esc(typeof item.amount === "number" ? item.amount.toFixed(2) : item.amount)}" style="width:${customInputWidth(typeof item.amount === "number" ? item.amount.toFixed(2) : item.amount)}" data-draft-field="item-amount" data-item="${item.id}"></label><button class="icon-btn" data-action="remove-item" data-id="${c.id}" data-item="${item.id}" aria-label="Remove item ${index + 1}">${icon("x")}</button></div></article>`).join("")}${
      d.items.length
        ? `<div class="receipt-adjustments inline-adjustments">${[
            ["tax", "Tax"],
            ["tip", "Tip"],
          ]
            .map(
              ([field, label]) =>
                `<label class="adjustment-field"><span>${label}</span><span class="custom-allocation"><span aria-hidden="true">$</span><input class="custom-input" type="text" inputmode="decimal" autocomplete="off" aria-label="${label} in dollars" value="${esc(typeof d[field] === "number" ? d[field].toFixed(2) : d[field])}" style="width:${customInputWidth(typeof d[field] === "number" ? d[field].toFixed(2) : d[field])}" data-draft-field="${field}"></span></label>`,
            )
            .join("")}</div>`
        : ""
    }${d.method === "item" && currentProposal(c).method === "item" && currentProposal(c).items.length ? '<p class="item-reset-notice">Confirming changes to this list resets everyone’s selections and approvals.</p>' : ""}<p class="draft-validation" id="draft-total" role="status">${esc(draftValidationText(c, d))}</p></section>`;
  }
  function itemFlowShell(
    c,
    p,
    card,
    selecting = false,
    share = currentPersonalAllocation(c),
  ) {
    return `${backbar("Edit split")}${splitSummary(c, share)}<div class="segmented" role="group" aria-label="Split method">${[
      ["item", "By item"],
      ["equal", "Equally"],
      ["custom", "Custom"],
    ]
      .map(
        ([method, label]) =>
          `<button class="${p.method === method ? "active" : ""}" data-action="${selecting ? "selection-method" : "draft-method"}" data-id="${c.id}" data-method="${method}" aria-pressed="${p.method === method}">${label}</button>`,
      )
      .join("")}</div>${memberAllocations(c, p, true)}${card}`;
  }
  function splitEdit(id) {
    const c = pending.find((c) => c.id === id),
      d = state.splitDrafts[id];
    return itemFlowShell(c, d, d.method === "item" ? itemEditor(c, d) : "");
  }
  function splitFooter(id, editing = false, selecting = false) {
    const c = pending.find((c) => c.id === id),
      p = editing && !selecting ? state.splitDrafts[id] : currentProposal(c);
    if (!c.canReview)
      return '<div class="footer-action"><p class="info-text">This charge is frozen while a dispute is resolved.</p></div>';
    if (editing)
      return `<div class="footer-action split-footer-buttons">${button("Cancel", selecting ? "back" : "cancel-edit", "", "secondary")}${button("Propose changes", selecting ? "confirm-selection" : "submit-proposal", `data-id="${id}"`)}</div>`;
    return `<div class="footer-action split-footer-buttons">${button("Make changes", "begin-edit", `data-id="${id}"`, "secondary")}${p.method === "item" ? button("Accept my share", "begin-selection", `data-id="${id}" ${!p.exclusive || p.receiptDraft || validateItemList(c, p).error ? "disabled" : ""}`) : button(state.approved[id] ? "Accepted" : "Accept my share", "accept-split", `data-id="${id}" ${state.approved[id] ? "disabled" : ""}`)}</div>`;
  }

  let renderRevision = 0,
    renderedRouteKey = null,
    activeScreenAnimation = null;
  function render(enter = false, options = {}) {
    const r = current(),
      key = routeKey(),
      app = $("#app"),
      oldScreen = $(".screen", app),
      sameRoute = renderedRouteKey === key;
    const desiredScroll = options.resetScroll
      ? 0
      : sameRoute && oldScreen
        ? oldScreen.scrollTop
        : state.scroll[key] || 0;
    const focused = document.activeElement,
      focusedAction =
        sameRoute && oldScreen?.contains(focused) && focused?.dataset.action
          ? { ...focused.dataset }
          : null;
    const revision = ++renderRevision;
    activeScreenAnimation?.cancel();
    activeScreenAnimation = null;
    let html = "",
      footer = "";
    switch (r.type) {
      case "home":
        html = home();
        break;
      case "all-pending":
        html = allPending();
        break;
      case "groups":
        html = groupsPage();
        break;
      case "spending":
        html = spending();
        break;
      case "group":
        html = groupDetail(r.id);
        break;
      case "wallet":
        html = wallet(r.id);
        break;
      case "group-edit":
        html = groupEdit(r.id);
        break;
      case "split":
        html = split(r.id);
        footer = splitFooter(r.id);
        break;
      case "split-edit":
        html = splitEdit(r.id);
        footer = splitFooter(r.id, true);
        break;
      case "select-items":
        html = selectItems(r.id);
        footer = splitFooter(r.id, true, true);
        break;
      case "history":
        html = chargeHistory(r.id);
        break;
      case "invitations":
        html = invitations();
        break;
      case "notifications":
        html = notifications();
        break;
      case "profile":
        html = profile();
        break;
      case "create":
        html = createGroup();
        break;
      case "statistics":
        html = groupStatistics(r.id);
        break;
      default:
        html = groupMenu(r.type, r.id);
    }
    const markup = `<section class="screen ${enter ? "enter" : ""} ${["split", "split-edit", "select-items"].includes(r.type) ? "split-screen" : ""} ${r.type === "wallet" ? "wallet-screen" : ""} ${r.type === "home" ? "home-screen" + (pending.length < 3 ? " home-sparse" : "") : ""}" tabindex="-1">${html}</section>${footer}`;
    const persistentNav = !state.stack.length ? $(".bottom-nav", app) : null;
    if (persistentNav) {
      oldScreen?.remove();
      $(".footer-action", app)?.remove();
      app.insertAdjacentHTML("afterbegin", markup);
      persistentNav.querySelectorAll("[data-tab]").forEach((button) => {
        const selected = button.dataset.tab === state.tab;
        button.classList.toggle("active", selected);
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
    } else app.innerHTML = markup + (!state.stack.length ? navBar() : "");
    const screen = $(".screen", app);
    renderedRouteKey = key;
    screen.scrollTop = desiredScroll;
    bindSplitPin();
    if (focusedAction) {
      const replacement = [...screen.querySelectorAll("[data-action]")].find(
        (button) =>
          Object.entries(focusedAction).every(
            ([name, value]) => button.dataset[name] === value,
          ),
      );
      replacement?.focus({ preventScroll: true });
    } else if (enter) {
      const heading = $("h1", screen) || $(".backbar strong", screen);
      if (heading) {
        heading.tabIndex = -1;
        heading.classList.add("focus-heading");
        heading.focus({ preventScroll: true });
      }
    }
    screen.scrollTop = desiredScroll;
    const appliedScroll = screen.scrollTop;
    state.scroll[key] = appliedScroll;
    requestAnimationFrame(() => {
      if (
        revision !== renderRevision ||
        routeKey() !== key ||
        screen !== $(".screen", app) ||
        screen.scrollTop !== appliedScroll
      )
        return;
      screen.scrollTop = desiredScroll;
      state.scroll[key] = screen.scrollTop;
    });
    if (
      options.tabDirection &&
      screen.animate &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      activeScreenAnimation = screen.animate(
        [
          {
            transform: `translateX(${options.tabDirection > 0 ? 24 : -24}%)`,
            opacity: 0.65,
          },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: 230, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
  }
  let lastFocus;
  function modal(title, body) {
    lastFocus = document.activeElement;
    $("#modal-root").innerHTML =
      `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon("x")}</button></div>${body}</section></div>`;
    $("#app").inert = true;
    requestAnimationFrame(() =>
      $(".modal input, .modal button, .modal select")?.focus({
        preventScroll: true,
      }),
    );
  }
  function closeModal() {
    $("#modal-root").innerHTML = "";
    $("#app").inert = false;
    state.modal = null;
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }
  function simpleModal(title, body) {
    modal(
      title,
      `<p class="info-text">${body}</p>${button("Got it", "close-modal", "", "full")}`,
    );
  }
  function showFundForm(id, kind) {
    const g = gById(id);
    if (kind === "withdraw" && g.withdrawalBlocked) {
      simpleModal(
        "A split is still pending",
        "You can withdraw after every open split in " +
          esc(g.name) +
          " has settled. Approving your own share alone does not settle a split.",
      );
      return;
    }
    modal(
      kind === "add" ? "Add funds" : "Withdraw funds",
      `<form data-form="funds" data-id="${id}" data-kind="${kind}"><label class="field"><span>Amount ($)</span><input name="amount" type="number" min="0.01" step=".01" ${kind === "withdraw" ? `max="${g.balance}"` : ""} placeholder="0.00" required><small>${kind === "withdraw" ? "Your available balance: " + money(g.balance) : "Add to your balance in " + esc(g.name)}</small></label><p class="form-error" role="alert"></p><button class="button full" type="submit">Review ${kind === "add" ? "contribution" : "withdrawal"}</button><p class="form-footnote">Money transfers are simulated in this hackathon version.</p></form>`,
    );
  }

  on("input", (e) => {
    const field = e.target.dataset.draftField;
    if (!field || current().type !== "split-edit") return;
    const c = pending.find((c) => c.id === current().id),
      d = state.splitDrafts[c.id];
    if (field === "percentage") {
      if (!d.percentageDraft)
        d.percentageDraft = makePercentageDraft(d.allocation);
      if (d.percentageDraft)
        d.percentageDraft.values[Number(e.target.dataset.person)] =
          e.target.value;
    } else if (field === "allocation") {
      delete d.percentageDraft;
      d.allocation[Number(e.target.dataset.person)] = e.target.value;
    } else if (field === "tax" || field === "tip") d[field] = e.target.value;
    else {
      const item = d.items.find((item) => item.id === e.target.dataset.item);
      if (item)
        item[field === "item-name" ? "name" : "amount"] = e.target.value;
    }
    if (
      ["percentage", "allocation", "item-amount", "tax", "tip"].includes(field)
    )
      e.target.style.width = customInputWidth(e.target.value);
    refreshDraftSummary(c, d);
  });
  on("keydown", (e) => {
    const m = $(".modal");
    if (!m) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
    if (e.key === "Tab") {
      const f = [
        ...m.querySelectorAll("button:not(:disabled),input,select,a[href]"),
      ];
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f.at(-1).focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
        e.preventDefault();
        f[0].focus({ preventScroll: true });
      }
    }
  });

  function groupEdit(id) {
    const g = gById(id),
      photo =
        state.photoDraft?.id === id ? state.photoDraft.photo : groupPhoto(g);
    return `${backbar("Group name & photo")}<h1 class="page-title">Make it yours.</h1><p class="page-sub">A familiar face for your shared plans.</p><form data-form="group-edit" data-id="${id}"><div class="photo-edit-preview"><img id="group-photo-preview" src="${esc(photo || groupPhotos.apartment)}" alt="Selected group photo"></div><label class="field"><span>Group name</span><input name="name" value="${esc(g.name)}" maxlength="32" required></label><fieldset class="photo-options"><legend>Group photo</legend>${Object.entries(
      groupPhotos,
    )
      .map(
        ([key, src]) =>
          `<label><input type="radio" name="group-photo" value="${key}" ${photo === src ? "checked" : ""}><img src="${src}" alt="${key === "weekend" ? "Dinner table" : key === "roadtrip" ? "Forest" : "Apartment"}"></label>`,
      )
      .join(
        "",
      )}</fieldset><label class="upload-photo">${icon("plus")} Choose your own photo<input type="file" id="photo-upload" accept="image/jpeg,image/png,image/webp,image/gif"><small>JPG, PNG, WebP or GIF · up to 5 MB · stays on this page</small></label><p class="form-error" role="alert"></p><button class="button full" type="submit">Save changes</button></form>`;
  }

  function contactless() {
    return `<svg class="contactless" viewBox="0 0 72 72" fill="none" aria-hidden="true"><circle cx="36" cy="36" r="32" stroke="#1683ff" stroke-width="4"/><path d="M20 63V28a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v35" stroke="#1683ff" stroke-width="2.5"/><path d="M33 27h6" stroke="#1683ff" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  }
  function wallet(id) {
    const g = gById(id),
      c = pending.find((c) => c.id === state.paymentResult);
    if (!g.wallet && g.cardId)
      return `${backbar("Your card")}<div class="native-wallet-card">${cardVisual(g)}</div><div class="receipt-empty"><h1>Set up your card</h1><p class="info-text">Activate this simulated card for purchases in ${esc(g.name)}.</p>${button("Set up simulated wallet", "setup-wallet", `data-id="${id}"`, "full")}</div>`;
    if (c)
      return `${backbar("")}<div class="payment-success native-success"><div class="success-circle">${icon("check")}</div><h1>Payment confirmed</h1><div class="payment-amount">${money(c.total)}</div><p>Blue Bottle</p><div class="wallet-card-arrival">${cardVisual(g)}</div><p class="info-text">Your ${money(currentPersonalAllocation(c))} share is ready to review.</p>${button("Review split", "wallet-review", "", "full")}${button("Back to group", "wallet-done", "", "secondary full")}</div>`;
    return `${backbar("")}<div class="native-wallet-card wallet-card-arrival">${cardVisual(g)}</div><div class="reader-prompt">${contactless()}<h1>Hold Near Reader</h1></div><form class="wallet-bottom" data-form="payment" data-id="${id}"><label class="wallet-amount-widget"><span>Amount<small>Blue Bottle</small></span><span class="wallet-amount-input"><span>$</span><input name="amount" aria-label="Purchase amount in dollars" type="number" min="0.01" step=".01" value="24.00" required></span></label><p class="form-error" role="alert"></p><button class="button full payment-button" type="submit" ${state.frozen[id] || g.forming ? "disabled" : ""}>Simulate payment</button>${state.frozen[id] || g.forming ? `<p class="form-footnote">${state.frozen[id] ? "Unfreeze this card to continue." : "This group must activate before purchases."}</p>` : ""}</form>`;
  }

  function loadSampleItems(id) {
    const c = pending.find((c) => c.id === id),
      d = state.splitDrafts[id];
    if (!d || !d.manualEntry) return;
    d.method = "item";
    delete d.percentageDraft;
    d.receipt = {
      ...(d.receipt || { kind: "manual", name: "Entered items" }),
      itemSource: "sample",
    };
    if (c.id === "juniper") {
      d.items = [
        ["burrata", "Burrata", 16],
        ["pizza", "Margherita pizza", 24],
        ["rigatoni", "Rigatoni", 28],
        ["branzino", "Branzino", 36],
        ["tiramisu", "Tiramisu", 10],
        ["water", "Sparkling water", 6],
      ].map(([id, name, amount]) => ({ id, name, amount, assignees: [] }));
      d.tax = 10.2;
      d.tip = 24;
    } else {
      d.items = equalAllocation(c.total, 2)
        .filter((amount) => amount > 0)
        .map((amount, index) => ({
          id: "sample-" + index,
          name: index ? "Sample extras" : "Sample purchase",
          amount,
          assignees: [],
        }));
      d.tax = 0;
      d.tip = 0;
    }
  }
  function draftValidationText(c, d) {
    const result = calculateProposal(c, d);
    return result.incompleteItem || (d.method === "item" && !d.items.length)
      ? ""
      : result.error || "";
  }
  function refreshDraftSummary(c, d) {
    const result = calculateProposal(c, d);
    const validation = $("#draft-total");
    if (validation) validation.textContent = draftValidationText(c, d);
    root
      .querySelectorAll("[data-draft-share]")
      .forEach(
        (el) =>
          (el.textContent = result.error
            ? "—"
            : allocationText(
                c,
                result.allocation,
                Number(el.dataset.draftShare),
              )),
      );
  }

  function bindSplitPin() {
    if (!["split", "split-edit", "select-items"].includes(current().type))
      return;
    const screen = $(".screen"),
      summary = $(".split-summary");
    if (!summary) return;
    const update = () =>
      summary.style.setProperty(
        "--compact",
        String(Math.max(0, Math.min(1, (screen.scrollTop - 24) / 72))),
      );
    screen.addEventListener("scroll", update, { passive: true });
    update();
  }
  let swipeStart = null,
    suppressCardClickUntil = 0;
  on("pointerdown", (e) => {
    const el = e.target.closest("[data-carousel]");
    if (el)
      swipeStart = { id: el.dataset.carousel, x: e.clientX, y: e.clientY };
  });
  on("pointerup", (e) => {
    if (!swipeStart) return;
    const start = swipeStart;
    swipeStart = null;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      suppressCardClickUntil = Date.now() + 500;
      e.preventDefault();
      setCarousel(start.id, (state.carousel[start.id] || 0) === 0 ? 1 : 0);
    }
  });
  on("pointercancel", () => {
    swipeStart = null;
  });
  on("keydown", (e) => {
    const carousel = e.target.closest("[data-carousel]");
    if (carousel && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      setCarousel(
        carousel.dataset.carousel,
        (state.carousel[carousel.dataset.carousel] || 0) === 0 ? 1 : 0,
      );
    }
  });

  function adopt(next) {
    snapshot = next;
    groups = next.groups;
    pending = next.pending;
    charges = next.charges;
    people = next.people;
    invites = next.invites;
    Object.assign(state, next.state);
    state.autofill = next.state.autoRefill || next.state.autofill || {};
    for (const g of groups)
      colors[g.id] = memberColors[groups.indexOf(g) % memberColors.length];
    if (!initialized) {
      state.month = next.calendar.month;
      initialized = true;
    }
    if (state.filter !== "all" && !groups.some((g) => g.id === state.filter))
      state.filter = "all";
  }
  function update(next) {
    if (disposed) return;
    adopt(next);
    if (!busy && !root.contains(document.activeElement?.closest("form")))
      safeRender();
  }
  function safeRender() {
    const previousRoute = routeKey();
    let r = current();
    if (
      r.id &&
      !["split", "split-edit", "select-items"].includes(r.type) &&
      !groups.some((g) => g.id === r.id)
    ) {
      state.stack = [];
      r = current();
    }
    if (
      (r.type === "split-edit" && !state.splitDrafts[r.id]) ||
      (r.type === "select-items" && !state.selectionDrafts[r.id])
    ) {
      state.stack[state.stack.length - 1] = { type: "split", id: r.id };
      r = current();
    }
    if (
      ["split", "split-edit", "select-items"].includes(r.type) &&
      !pending.some((c) => c.id === r.id)
    ) {
      state.stack = state.stack.filter(
        (r) => !["split", "split-edit", "select-items"].includes(r.type),
      );
      toast("This charge has settled.");
    }
    if (routeKey() !== previousRoute) syncRoute();
    render();
  }
  async function call(method, args) {
    const result = await bridge.call(method, args);
    if (!result)
      throw Error(
        "The change could not be saved. Refresh to check its status before trying again.",
      );
    if (bridge.snapshot) adopt(bridge.snapshot(result));
    return result;
  }
  async function act(work) {
    if (busy) return;
    busy = true;
    root.setAttribute("aria-busy", "true");
    let failed = false;
    try {
      await work();
    } catch (error) {
      failed = true;
      toast(error.message || "Could not complete this action.");
    } finally {
      busy = false;
      root.removeAttribute("aria-busy");
      if (!disposed && !failed && !$(".modal")) safeRender();
    }
  }
  const periodDays = (label) =>
    label === "Every week" ? 7 : label === "Every 2 weeks" ? 14 : 30;
  const cents = (value) => {
    const n = moneyCents(value);
    if (n === null)
      throw Error("Enter an amount with at most two decimal places.");
    return n;
  };
  function displayMonth(month = state.month) {
    return new Date(snapshot.calendar.year, month, 1).toLocaleDateString(
      "en-US",
      { month: "long", year: "numeric" },
    );
  }
  function monthDays(month = state.month) {
    return month === snapshot.calendar.month
      ? snapshot.calendar.day
      : new Date(snapshot.calendar.year, month + 1, 0).getDate();
  }
  function cumulativePoints(
    groupId,
    width,
    height,
    maximum,
    month = state.month,
    memberId = null,
  ) {
    const series = monthCharges(month).filter(
        (c) => !groupId || c.group === groupId,
      ),
      days = monthDays(month);
    return Array.from(
      { length: days },
      (_, i) =>
        `${((i * width) / Math.max(1, days - 1)).toFixed(2)},${(height - (series.filter((c) => c.day <= i + 1).reduce((s, c) => s + Math.round((memberId ? c.memberShares[memberId] || 0 : c.amount) * 100), 0) / 100 / maximum) * (height - 8)).toFixed(2)}`,
    ).join(" ");
  }
  function chart(series, month = state.month, hero = false) {
    const max = Math.max(
        10,
        Math.ceil(Math.max(0, ...series.map((s) => s.total)) / 50) * 50,
      ),
      height = hero ? 75 : 157,
      width = hero ? 282 : 310;
    return `<svg class="${hero ? "hero-chart" : "spending-chart"}" viewBox="0 0 ${width + 38} ${height + 8}" preserveAspectRatio="none" role="img" aria-label="Settled spending in ${displayMonth(month)}: ${esc(series.map((s) => s.name + " " + money(s.total)).join(", "))}">${[
      [8, max],
      [(height + 8) / 2, max / 2],
      [height, 0],
    ]
      .map(
        ([y, n]) =>
          `<text x="0" y="${y + 3}" fill="${hero ? "#aabbd6" : "#626a78"}" font-size="8">$${n}</text><line x1="38" x2="${width + 38}" y1="${y}" y2="${y}" stroke="${hero ? "#ffffff22" : "#e8ebf0"}" stroke-dasharray="3 5"/>`,
      )
      .join(
        "",
      )}<g transform="translate(38 0)">${series.map((s) => `<polyline points="${cumulativePoints(s.groupId, width, height, max, month, s.memberId)}" fill="none" stroke="${s.dimmed ? "#c4cad4" : s.color}" stroke-width="2.5" ${s.dimmed ? 'stroke-dasharray="5 5"' : ""} stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</g></svg>`;
  }
  function homeSparkline() {
    return chart(
      [
        {
          name: "Your spending",
          total: spendingTotal(snapshot.calendar.month),
          color: "#6890ff",
        },
      ],
      snapshot.calendar.month,
      true,
    );
  }
  function home() {
    const month = snapshot.calendar.month,
      total = money(spendingTotal(month)).split(".");
    return `${rootHeader()}<div class="home-welcome"><h1 class="greeting">Hey, ${esc(state.displayName)} <span style="font-size:22px">✦</span></h1><div class="eyebrow greeting-sub">${new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}</div></div><section class="hero" aria-label="Settled spending"><div class="hero-head"><span>Your spend this month</span><span>${displayMonth(month)}</span></div><div class="hero-amount">${total[0]}<span class="cents">.${total[1]}</span></div>${homeSparkline()}<div class="hero-foot"><span>${new Date(snapshot.calendar.year, month, 1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><span>${new Date(snapshot.calendar.year, month, snapshot.calendar.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div></section><div class="section-heading"><h2>Pending charges</h2></div><div class="pending-list">${pending.length ? pending.slice(0, 3).map(pendingCard).join("") : '<div class="empty"><p>You’re all caught up.</p></div>'}</div>${pending.length > 3 ? button("+" + (pending.length - 3) + " more " + icon("arrow-right"), "all-pending", "", "more-pending") : ""}`;
  }
  function spending() {
    const selected = state.filter === "all" ? null : state.filter,
      series = groups.map((g) => ({
        groupId: g.id,
        name: g.name,
        total: spendingTotal(state.month, g.id),
        color: colors[g.id],
        dimmed: !!selected && selected !== g.id,
      })),
      total = series.reduce((s, g) => s + g.total, 0);
    const rows = [
      ...pending
        .filter(
          (c) => c.month === state.month && c.year === snapshot.calendar.year,
        )
        .map((c) => ({ ...c, isPending: true })),
      ...monthCharges(state.month),
    ].filter((c) => !selected || c.group === selected);
    return `${rootHeader()}<h1 class="page-title">Spending</h1><p class="eyebrow">A clearer picture of your shared life.</p>${monthSelector()}<section class="card-section"><div class="eyebrow">Your total spending</div><div class="spending-total">${money(total)}</div><p class="spending-caption">Settled purchases</p><div class="chart-wrap">${chart(series)}</div><div class="legend">${groups.map((g) => `<button class="${selected === g.id ? "selected" : selected ? "dimmed" : ""}" data-action="legend" data-id="${g.id}" aria-pressed="${!selected || selected === g.id}"><span class="legend-dot" style="background:${colors[g.id]}"></span>${esc(g.name)}</button>`).join("")}</div></section><div class="section-heading"><h2>All charges</h2><select class="filter-select" id="charge-filter" aria-label="Filter charges by group"><option value="all">All groups</option>${groups.map((g) => `<option value="${g.id}" ${selected === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div>${rows.length ? rows.map(chargeRow).join("") : '<div class="empty"><p>No charges this month.</p></div>'}`;
  }
  function monthSelector(id = null) {
    const month = id
      ? (state.memberMonth[id] ?? snapshot.calendar.month)
      : state.month;
    return `<div class="month-selector"><button data-action="${id ? "member-month" : "month"}" ${id ? 'data-id="' + id + '"' : ""} data-dir="-1" aria-label="Previous month" ${month === 0 ? "disabled" : ""}>${icon("chevron-left")}</button><strong>${displayMonth(month)}</strong><button data-action="${id ? "member-month" : "month"}" ${id ? 'data-id="' + id + '"' : ""} data-dir="1" aria-label="Next month" ${month >= snapshot.calendar.month ? "disabled" : ""}>${icon("chevron-right")}</button></div>`;
  }
  function groupStatistics(id) {
    const g = gById(id),
      month = state.memberMonth[id] ?? snapshot.calendar.month,
      selected = state.memberFocus[id],
      members = groupMembers(g),
      series = members.map((p, i) => ({
        groupId: id,
        memberId: p.id,
        name: memberLabel(p),
        total: memberSpendingTotal(month, id, p.id),
        color: memberColors[i % memberColors.length],
        dimmed: !!selected && selected !== p.id,
      }));
    return `${backbar("Group statistics")}<h1 class="page-title">${esc(g.name)}</h1>${monthSelector(id)}<section class="card-section member-statistics"><div class="eyebrow">Your group spending</div><div class="spending-total">${money(settledGroupTotal(month, id))}</div><p class="spending-caption">${members.length} members · Settled purchases</p><div class="chart-wrap">${chart(series, month)}</div><div class="legend member-legend">${series.map((s) => `<button class="${selected === s.memberId ? "selected" : selected ? "dimmed" : ""}" data-action="member-focus" data-id="${id}" data-member="${s.memberId}" aria-pressed="${!selected || selected === s.memberId}"><span class="legend-dot" style="background:${s.color}"></span><span>${esc(s.name)}</span><strong>${money(s.total)}</strong></button>`).join("")}</div></section><div class="section-heading"><h2>Your charges</h2></div>${groupHistoryRows(id, month)}`;
  }
  function groupSpendPanel(g) {
    const month = snapshot.calendar.month;
    return `<div class="group-spend-panel"><div class="row"><span class="eyebrow">Your group spending</span><span class="eyebrow">${displayMonth(month)}</span></div><strong>${money(spendingTotal(month, g.id))}</strong>${chart([{ groupId: g.id, name: g.name, total: spendingTotal(month, g.id), color: "#2459e8" }], month)}<div class="row"><span class="eyebrow">Settled purchases</span><button class="text-action" data-action="group-menu" data-menu="statistics" data-id="${g.id}">View details ${icon("arrow-right")}</button></div></div>`;
  }
  function invitations() {
    return `${backbar("Invitations")}<h1 class="page-title">You’re invited.</h1><p class="page-sub">A new shared plan starts here.</p>${invites.length ? invites.map((i) => `<section class="invitation"><div class="row">${stamp(i)}<span class="pill">Invitation</span></div><h2>${esc(i.name)}</h2><p class="info-text">${esc(i.from)} invited you · ${i.members} people</p><div class="subtle-divider"></div><div class="detail-row row"><span>Group budget</span><strong>${money(i.budget)}</strong></div><div class="detail-row row"><span>Your contribution cap</span><strong>${money(i.share)}</strong></div><p class="form-footnote">By accepting, you authorize up to ${money(i.share)} to be collected automatically when all invitations are resolved and at least two members have joined. Any increase needs your approval.</p><div class="actions-pair">${button("Decline", "invite", `data-id="${i.id}" data-response="declined"`, "secondary")}${button("Accept · " + money(i.share) + " cap", "invite", `data-id="${i.id}" data-response="accepted"`)}</div></section>`).join("") : '<div class="empty"><p>No invitations waiting.</p></div>'}`;
  }
  function notifications() {
    return `${backbar("Notifications")}<h1 class="page-title">You’re in the loop.</h1><p class="page-sub">A few things from your people.</p><div class="list-menu">${pending.map((c) => `<button class="menu-row" data-action="split" data-id="${c.id}">${merchantMark(c, true)}<span class="menu-copy">${esc(c.name)}<small>${state.approved[c.id] ? "Waiting for the group." : "Your share is ready to review."}</small></span>${icon("chevron-right")}</button>`).join("")}<button class="menu-row" data-action="invitations">${icon("mail")}<span class="menu-copy">Group invitations<small>${invites.length} to review</small></span>${icon("chevron-right")}</button></div>`;
  }
  function profile() {
    return `${backbar("Your profile")}<div class="profile-identity">${avatar(people[0], true)}<h1>${esc(state.fullName)}</h1><small>@${esc(state.handle)}${bridge.session.demoMode ? " · Demo account" : ""}</small></div><div class="list-menu">${[
      ["edit-profile", "users", "Personal details", "Name and profile"],
      [
        "notifications-settings",
        "bell",
        "Notifications",
        "Updates while the app is open",
      ],
      ["privacy", "shield", "Privacy", "Your groups and information"],
      ["about", "help-circle", "About chipin", "Hackathon version"],
    ]
      .map(
        ([a, i, t, s]) =>
          `<button class="menu-row" data-action="${a}">${icon(i)}<span class="menu-copy">${t}<small>${s}</small></span>${icon("chevron-right")}</button>`,
      )
      .join(
        "",
      )}</div>${bridge.session.demoMode ? `<section class="card-section"><h2>Demo account</h2><select id="demo-user" aria-label="Demo account">${(snapshot.demoUsers || people).map((p) => `<option value="${p.id}" ${p.id === snapshot.viewer.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></section>` + button("Exit demo mode", "exit-demo", "", "secondary full") : button("Try demo mode", "enter-demo", "", "secondary full")}${button("Sign out", "sign-out", "", "secondary full")}`;
  }
  function groupMenu(type, id) {
    const g = gById(id),
      title = {
        funds: "Funds",
        card: "Your card",
        members: "Members",
        budget: "Budget",
        settings: "Group settings",
      }[type];
    let body = "";
    if (type === "funds")
      body = `<section class="card-section"><div class="eyebrow">Your balance in ${esc(g.name)}</div><div class="spending-total">${money(g.balance)}</div><p class="spending-caption">${money(g.power)} available in the group</p><div class="actions-pair">${button(icon("plus") + " Add funds", "fund-form", `data-id="${id}" data-kind="add"`)}${button(icon("arrow-up-right") + " Withdraw", "fund-form", `data-id="${id}" data-kind="withdraw"`, "secondary")}</div></section><div class="callout neutral">${icon("info")}<span>${g.withdrawalBlocked ? "Withdrawals are unavailable while this group has an unsettled split or is frozen." : "Only your own available balance can be withdrawn."}</span></div><section class="card-section"><div class="row"><div><strong>Auto-refill</strong><p class="info-text">Top up to your share each period.</p></div><button class="toggle ${state.autofill[id] ? "on" : ""}" role="switch" aria-checked="${!!state.autofill[id]}" aria-label="Auto-refill" data-action="toggle" data-id="${id}" data-key="autofill"></button></div></section>`;
    if (type === "card")
      body = `<button class="card-launch" data-action="wallet" data-id="${id}">${cardVisual(g)}</button><p class="card-caption">Simulated virtual card</p><section class="card-section"><div class="row"><div><strong>Freeze card</strong><p class="info-text">Temporarily pause this card.</p></div><button class="toggle ${state.frozen[id] ? "on" : ""}" role="switch" aria-checked="${!!state.frozen[id]}" aria-label="Freeze card" data-action="toggle" data-id="${id}" data-key="frozen"></button></div></section>`;
    if (type === "members")
      body = `<h1 class="page-title">Your people.</h1><p class="page-sub">${g.members} members · ${esc(g.name)}</p><section class="card-section">${g.people.map((p) => `<div class="person-row">${avatar(p)}<div class="person-info"><strong>${esc(p.name)}${p.id === snapshot.viewer.id ? " (you)" : ""}</strong><small>${p.id === g.createdBy ? "Group creator" : "Member"}</small></div><span class="pill ${p.status === "joined" ? "success" : ""}">${p.status === "invited" ? "Invited" : "Joined"}</span></div>`).join("")}</section>`;
    if (type === "budget")
      body = `<section class="card-section"><div class="eyebrow">Current group budget</div><div class="spending-total">${money(g.budget)}</div><p class="spending-caption">${g.period}</p></section><form data-form="budget" data-id="${id}"><label class="field"><span>Propose a new budget</span><input name="budget" type="number" min=".01" step=".01" required value="${g.budget}"><small>Everyone must agree. The new budget takes effect next period.</small></label><p class="form-error" role="alert"></p><button class="button full" type="submit">Review proposal ${icon("arrow-right")}</button></form>${g.budgetProposal ? `<section class="card-section"><h2>Proposed budget: ${money(g.budgetProposal.amount)}</h2><p class="info-text">${g.budgetProposal.acceptedBy.length} members approved.</p><div class="actions-pair">${button("Reject", "budget-response", `data-id="${g.budgetProposal.id}" data-response="false"`, "secondary")}${button("Accept", "budget-response", `data-id="${g.budgetProposal.id}" data-response="true"`)}</div></section>` : ""}`;
    if (type === "settings")
      body = `<div class="settings-group">${stamp(g)}<div><strong>${esc(g.name)}</strong><small>${g.members} members</small></div></div><div class="list-menu settings-menu">${[
        ["group-edit", "settings", "Group name & photo", "Make it yours"],
        ["members", "users", "Members", g.members + " people"],
        ["budget", "calendar", "Budget", money(g.budget) + " · " + g.period],
      ]
        .map(
          ([route, i, label, detail]) =>
            `<button class="menu-row" data-action="group-menu" data-id="${id}" data-menu="${route}">${icon(i)}<span class="menu-copy">${label}<small>${esc(detail)}</small></span>${icon("chevron-right")}</button>`,
        )
        .join(
          "",
        )}</div><section class="card-section"><label class="field"><span>Default split</span><select id="default-split" data-id="${id}">${g.defaultSplit === "custom" ? '<option value="custom" selected disabled>Custom percentages</option>' : ""}<option value="equal" ${g.defaultSplit === "equal" ? "selected" : ""}>Equally</option><option value="item" ${g.defaultSplit === "item" ? "selected" : ""}>By item</option></select><small>By item starts with equal shares until a receipt is confirmed.</small></label></section>`;
    return backbar(title) + body;
  }
  function createGroup() {
    return `${backbar("New group")}<h1 class="page-title">Make room for together.</h1><p class="page-sub">Start with your people and a shared budget.</p><form data-form="create"><label class="field"><span>Group name</span><input name="name" placeholder="e.g. The apartment" maxlength="32" required></label><div class="fields-row"><label class="field"><span>Group budget ($)</span><input name="budget" type="number" min=".01" step=".01" required></label><label class="field"><span>Period</span><select name="period"><option>Every month</option><option>Every 2 weeks</option><option>Every week</option></select></label></div><label class="field"><span>Invite your people</span><input name="member-search" id="member-search" placeholder="Search name, username, email or phone" autocomplete="off"></label><div id="member-results"></div><div id="selected-members"></div><div class="callout">${icon("info")}<span>Contributions collect automatically after all invitations are resolved and at least two people join. Any increase above an approved cap needs fresh approval.</span></div><p class="form-error" role="alert"></p><button class="button full" type="submit">Review group ${icon("arrow-right")}</button></form>`;
  }
  async function confirmItemList(id) {
    const c = pending.find((c) => c.id === id),
      d = state.splitDrafts[id],
      valid = validateItemList(c, d);
    if (valid.error) throw Error(valid.error);
    await call("confirmReceiptList", [
      id,
      {
        items: d.items.map((i) => ({
          id: i.id,
          name: i.name.trim(),
          amount: cents(i.amount),
        })),
        tax: cents(d.tax),
        tip: cents(d.tip),
        image: d.receipt?.image || null,
      },
      d.editKey,
    ]);
    advanceItemSelection(id);
  }
  async function confirmSelection(id) {
    const d = state.selectionDrafts[id];
    await call("confirmItemSelection", [id, d.ids, d.receiptKey]);
    delete state.selectionDrafts[id];
    back();
    toast(pending.some((c) => c.id === id) ? "Your selection is confirmed." : "This charge has settled.");
  }
  async function submitSplitProposal(id) {
    const c = pending.find((c) => c.id === id),
      d = state.splitDrafts[id];
    if (d.method === "item") return confirmItemList(id);
    const result = calculateProposal(c, d);
    if (result.error) throw Error(result.error);
    const published = currentProposal(c),
      sameAllocation = result.allocation.every(
        (value, i) => cents(value) === cents(currentAllocation(c)[i]),
      ),
      participants =
        d.participants ||
        c.canonicalMemberIds ||
        chargePeople(c).map((p) => p.id),
      samePeople =
        d.method !== "equal" ||
        JSON.stringify([...participants].sort()) ===
          JSON.stringify([...(published.participants || [])].sort());
    const unchanged =
      d.method === published.method &&
      sameAllocation &&
      samePeople &&
      !published.receipt;
    const input =
      unchanged && published.sourceInput
        ? clone(published.sourceInput)
        : d.method === "equal"
          ? { method: "equal", participants: [...participants] }
          : {
              method: "amount",
              amounts: Object.fromEntries(
                chargePeople(c).map((p, i) => [
                  p.id,
                  cents(result.allocation[i]),
                ]),
              ),
            };
    await call("proposeSplit", [
      id,
      input,
      { acceptOwnShare: false, expectedEditKey: d.editKey },
    ]);
    finishSplitEdit(id);
    toast("Proposal submitted. Everyone reviews this version.");
  }
  async function acceptSplit(id) {
    const c = pending.find((c) => c.id === id);
    await call("acceptSplit", [id, c.proposalId]);
    toast("You accepted your share.");
  }
  async function simulatePayment(id, merchant, amount) {
    const prior = new Set(pending.map((c) => c.id));
    await call("purchase", [id, { merchant, amount: cents(amount) }]);
    const created = pending.find((c) => c.group === id && !prior.has(c.id));
    if (!created) throw Error("Payment saved. Refresh to see the charge.");
    state.paymentResult = created.id;
    await call("sendDefaultSplit", [created.id]);
  }
  async function photoData(file, maxChars = 250000) {
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024)
      throw Error("Choose an image up to 15 MB.");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      let data;
      for (let q = 0.85; q >= 0.25; q -= 0.1) {
        data = canvas.toDataURL("image/jpeg", q);
        if (data.length < maxChars) return data;
      }
      throw Error(
        "This image is too detailed. Crop the receipt and try again.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function readReceipt(input) {
    const file = input.files?.[0],
      r = current(),
      d = state.splitDrafts[r.id];
    if (!file || !d) return;
    const generation = d.generation;
    await act(async () => {
      const image = await photoData(file);
      const parsed = await bridge.parseReceipt(r.id, {
        data: image.split(",")[1],
        mediaType: "image/jpeg",
      });
      if (state.splitDrafts[r.id]?.generation !== generation) return;
      const scan = parsed.draft || parsed;
      d.items = scan.items.map((i, index) => ({
        id: i.id || "scan-" + index + "-" + generation,
        name: i.name,
        amount: i.amount / 100,
        assignees: [],
      }));
      d.tax = scan.tax / 100;
      d.tip = scan.tip / 100;
      d.receipt = { image, kind: "photo", name: file.name };
      d.manualEntry = true;
      toast("Receipt read. Check the items before confirming.");
    });
  }

  let selectedInvitees = [],
    searchResults = [],
    searchTimer,
    searchVersion = 0;
  function renderInvitees() {
    const el = $("#selected-members");
    if (el)
      el.innerHTML = selectedInvitees
        .map(
          (p) =>
            `<button type="button" class="menu-row" data-action="remove-invitee" data-id="${p.id}">${esc(p.name)} ${icon("x")}</button>`,
        )
        .join("");
  }
  function syncRoute() {
    const r = current();
    bridge.navigate?.({ ...r, tab: state.tab });
    if (r.id && groups.some((g) => g.id === r.id)) bridge.selectGroup?.(r.id);
  }
  function routeChanged() {
    const r = bridge.route;
    if (!r) return;
    const key = r.type + ":" + (r.id || "");
    if (key === routeKey()) return;
    state.tab = ["home", "groups", "spending"].includes(r.tab) ? r.tab : "home";
    if (["home", "groups", "spending"].includes(r.type)) {
      state.tab = r.type;
      state.stack = [];
    } else if (!["split-edit", "select-items"].includes(r.type))
      state.stack = [{ type: r.type, id: r.id }];
  }
  on("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    if (busy) {
      e.preventDefault();
      return;
    }
    if (Date.now() < suppressCardClickUntil && b.closest("[data-carousel]")) {
      e.preventDefault();
      return;
    }
    const { action, id, menu, tab, dir, method, response, key, kind } =
      b.dataset;
    const local = () => {
      switch (action) {
        case "tab":
          nav(tab);
          break;
        case "back":
        case "cancel-edit":
          back();
          break;
        case "profile":
        case "invitations":
        case "all-pending":
          push(action);
          break;
        case "notifications":
          state.notice = false;
          push("notifications");
          break;
        case "create":
          selectedInvitees = [];
          push("create");
          break;
        case "group":
          push("group", id);
          break;
        case "group-menu":
          if (menu === "group-edit")
            state.photoDraft = { id, photo: groupPhoto(gById(id)) };
          push(menu, id);
          break;
        case "split":
          push("split", id);
          break;
        case "wallet":
          state.paymentResult = null;
          push("wallet", id);
          break;
        case "wallet-review":
          push("split", state.paymentResult);
          break;
        case "wallet-done":
          back();
          break;
        case "carousel":
          setCarousel(id, Number(b.dataset.panel));
          break;
        case "close-modal":
          closeModal();
          break;
        case "month":
          state.month = Math.max(
            0,
            Math.min(snapshot.calendar.month, state.month + Number(dir)),
          );
          render();
          break;
        case "member-month":
          state.memberMonth[id] = Math.max(
            0,
            Math.min(
              snapshot.calendar.month,
              (state.memberMonth[id] ?? snapshot.calendar.month) + Number(dir),
            ),
          );
          render();
          break;
        case "member-focus":
          state.memberFocus[id] =
            state.memberFocus[id] === b.dataset.member
              ? null
              : b.dataset.member;
          render();
          break;
        case "legend":
          state.filter = state.filter === id ? "all" : id;
          render();
          break;
        case "receipt":
          state.receiptOpen[id] = !state.receiptOpen[id];
          render();
          break;
        case "begin-edit":
          beginSplitEdit(id);
          break;
        case "begin-selection":
          beginSelection(id);
          break;
        case "selection-method":
          beginSplitEdit(id);
          setDraftMethod(
            pending.find((c) => c.id === id),
            method,
          );
          break;
        case "toggle-selection":
          toggleSelection(id, b.dataset.item);
          break;
        case "split-unit":
          setSplitUnit(id, b.dataset.unit);
          break;
        case "draft-method":
          setDraftMethod(
            pending.find((c) => c.id === id),
            method,
          );
          break;
        case "remove-item":
          state.splitDrafts[id].items = state.splitDrafts[id].items.filter(
            (i) => i.id !== b.dataset.item,
          );
          render();
          break;
        case "add-item": {
          const d = state.splitDrafts[id];
          d.method = "item";
          delete d.percentageDraft;
          d.manualEntry = true;
          d.receipt ||= { kind: "manual", name: "Entered items" };
          d.items.push({
            id: "item-" + Date.now() + "-" + ++state.draftSequence,
            name: "",
            amount: "",
            assignees: [],
          });
          render();
          break;
        }
        case "sample-items":
          loadSampleItems(id);
          render();
          break;
        case "fund-form":
          showFundForm(id, kind);
          break;
        case "choose-invitee": {
          const person = searchResults.find((p) => p.id === id);
          if (person && !selectedInvitees.some((p) => p.id === id))
            selectedInvitees.push(person);
          $("#member-search").value = "";
          $("#member-results").innerHTML = "";
          renderInvitees();
          break;
        }
        case "remove-invitee":
          selectedInvitees = selectedInvitees.filter((p) => p.id !== id);
          renderInvitees();
          break;
        case "edit-profile":
          modal(
            "Personal details",
            `<form data-form="profile"><label class="field"><span>Name</span><input name="name" maxlength="80" required value="${esc(state.fullName)}"></label><p class="form-error" role="alert"></p><button class="button full" type="submit">Save changes</button></form>`,
          );
          break;
        case "notifications-settings":
          simpleModal(
            "Notifications",
            "Group and split updates appear here while the app is open. Push notifications are not connected in this version.",
          );
          break;
        case "privacy":
          simpleModal(
            "Your information",
            "Only group members can see their shared group activity. Receipt photos sent for scanning are processed by the configured receipt service.",
          );
          break;
        case "about":
          simpleModal(
            "chipin",
            "Shared groups, purchases and spending. This hackathon version simulates deposits, cards and payments.",
          );
          break;
        case "card-details":
          simpleModal(
            "Your card",
            "Simulated card ending " +
              esc(gById(id).last4 || "") +
              " · " +
              esc(state.fullName),
          );
          break;
        case "charge": {
          const c = charges.find((c) => c.id === id);
          if (!c) break;
          modal(
            esc(c.name),
            `<p class="info-text">${esc(gById(c.group).name)} · ${esc(c.date)}</p><div class="spending-total">${money(c.amount)}</div><p class="spending-caption">Your settled share</p><form data-form="note" data-id="${c.id}"><label class="field"><span>Shared note</span><input name="note" maxlength="280" value="${esc(c.note?.text || "")}"></label><button class="button full" type="submit">Save note</button></form>`,
          );
          break;
        }
        default:
          return false;
      }
      syncRoute();
      return true;
    };
    if (local()) return;
    void act(async () => {
      switch (action) {
        case "setup-wallet":
          await call("addToWallet", [gById(id).cardId, "Apple Wallet"]);
          break;
        case "confirm-selection":
          await confirmSelection(id);
          break;
        case "submit-proposal":
          await submitSplitProposal(id);
          break;
        case "accept-split":
          await acceptSplit(id);
          break;
        case "invite": {
          const i = invites.find((i) => i.id === id);
          await call("respondInvite", [
            id,
            response === "accepted",
            i.expectedContribution,
            i.initialContributionLimit,
          ]);
          toast(
            response === "accepted"
              ? "Invitation accepted."
              : "Invitation declined.",
          );
          break;
        }
        case "toggle": {
          const g = gById(id);
          await call(key === "frozen" ? "setCardFrozen" : "setAutoDeposit", [
            key === "frozen" ? g.cardId : id,
            !state[key][id],
          ]);
          break;
        }
        case "confirm-funds": {
          const d = state.fundDraft;
          await call(d.kind === "add" ? "deposit" : "withdraw", [
            d.id,
            d.amount,
          ]);
          closeModal();
          toast("Balance updated.");
          break;
        }
        case "confirm-create": {
          await call("createGroup", [state.groupDraft]);
          closeModal();
          nav("groups");
          toast("Group created. Invitations sent.");
          break;
        }
        case "confirm-budget":
          await call("proposeBudget", [id, state.budgetDraft]);
          closeModal();
          toast("Budget proposal sent.");
          break;
        case "budget-response":
          await call("respondBudget", [id, response === "true"]);
          break;
        case "sign-out":
          await bridge.session.signOut();
          break;
        case "enter-demo":
          bridge.session.enterDemo();
          break;
        case "exit-demo":
          bridge.session.exitDemo();
          break;
      }
      syncRoute();
    });
  });
  on("submit", (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    if (busy || !form.reportValidity()) return;
    const f = new FormData(form),
      id = form.dataset.id;
    void act(async () => {
      switch (form.dataset.form) {
        case "payment":
          await simulatePayment(id, "Blue Bottle", f.get("amount"));
          state.scroll[routeKey()] = 0;
          break;
        case "group-edit":
          await call("updateGroup", [
            id,
            {
              name: String(f.get("name")).trim(),
              photo: state.photoDraft?.photo || null,
            },
          ]);
          state.photoDraft = null;
          back();
          break;
        case "profile":
          await call("updateProfile", [{ name: String(f.get("name")).trim() }]);
          closeModal();
          break;
        case "note":
          await call("setChargeNote", [id, String(f.get("note")).trim()]);
          closeModal();
          break;
        case "create": {
          if (!selectedInvitees.length)
            throw Error("Choose at least one person to invite.");
          const budget = cents(f.get("budget")),
            cap = Math.ceil(budget / (selectedInvitees.length + 1));
          state.groupDraft = {
            name: String(f.get("name")).trim(),
            budget,
            periodDays: periodDays(f.get("period")),
            inviteIds: selectedInvitees.map((p) => p.id),
            initialContributionLimit: cap,
          };
          modal(
            "Review your group",
            `<div class="detail-row row"><span>Group</span><strong>${esc(state.groupDraft.name)}</strong></div><div class="detail-row row"><span>Budget</span><strong>${money(budget / 100)}</strong></div><div class="detail-row row"><span>Your contribution cap</span><strong>${money(cap / 100)}</strong></div><p class="info-text">${esc(selectedInvitees.map((p) => p.name).join(", "))}</p><p class="form-footnote">You authorize up to ${money(cap / 100)} at activation, after all invitations are resolved with at least two members. All money is simulated.</p>${button("Create group", "confirm-create", "", "full")}${button("Keep editing", "close-modal", "", "secondary full")}`,
          );
          break;
        }
        case "funds": {
          const amount = cents(f.get("amount"));
          if (amount <= 0) throw Error("Enter a positive amount.");
          state.fundDraft = { id, kind: form.dataset.kind, amount };
          modal(
            "Review " +
              (form.dataset.kind === "add" ? "contribution" : "withdrawal"),
            `<div class="eyebrow">${esc(gById(id).name)}</div><div class="spending-total">${money(amount / 100)}</div><p class="info-text">Confirm this simulated ${form.dataset.kind === "add" ? "contribution" : "withdrawal"}.</p>${button("Confirm", "confirm-funds", "", "full")}${button("Cancel", "close-modal", "", "secondary full")}`,
          );
          break;
        }
        case "budget": {
          state.budgetDraft = cents(f.get("budget"));
          if (state.budgetDraft <= 0) throw Error("Enter a positive budget.");
          modal(
            "Review budget proposal",
            `<div class="spending-total">${money(state.budgetDraft / 100)}</div><p class="info-text">Everyone must approve. The budget takes effect next period.</p>${button("Propose to group", "confirm-budget", `data-id="${id}"`, "full")}${button("Keep editing", "close-modal", "", "secondary full")}`,
          );
          break;
        }
      }
      syncRoute();
    });
  });
  on("change", (e) => {
    const target = e.target;
    if (target.id === "charge-filter") {
      state.filter = target.value;
      render();
    }
    if (target.id === "demo-user") bridge.session.setViewerId(target.value);
    if (target.matches('[name="group-photo"]')) {
      state.photoDraft = { id: current().id, photo: groupPhotos[target.value] };
      $("#group-photo-preview").src = state.photoDraft.photo;
    }
    if (target.id === "photo-upload" && target.files?.[0])
      void act(async () => {
        state.photoDraft = {
          id: current().id,
          photo: await photoData(target.files[0]),
        };
      });
    if (target.id === "receipt-upload") void readReceipt(target);
    if (target.id === "default-split")
      void act(() =>
        call("setDefaultSplit", [
          target.dataset.id,
          { method: target.value === "item" ? "items" : "equal" },
        ]),
      );
  });
  on("input", (e) => {
    if (e.target.id !== "member-search") return;
    clearTimeout(searchTimer);
    const query = e.target.value,
      version = ++searchVersion;
    searchTimer = setTimeout(async () => {
      try {
        searchResults = await bridge.searchUsers(
          query,
          selectedInvitees.map((p) => p.id),
        );
        if (disposed || version !== searchVersion || !$("#member-results"))
          return;
        $("#member-results").innerHTML =
          searchResults
            .map(
              (p) =>
                `<button type="button" class="menu-row" data-action="choose-invitee" data-id="${p.id}"><span class="menu-copy">${esc(p.name)}<small>@${esc(p.handle)}</small></span>${icon("plus")}</button>`,
            )
            .join("") ||
          (query.trim().length >= 2
            ? '<p class="info-text">No matching people.</p>'
            : "");
      } catch (error) {
        toast(error.message);
      }
    }, 250);
  });
  on("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) closeModal();
  });

  adopt(bridge.initialSnapshot);
  routeChanged();
  safeRender();
  return {
    update(next) {
      update(next);
      if (!busy) {
        routeChanged();
        if (!root.contains(document.activeElement?.closest("form")))
          safeRender();
      }
    },
    destroy() {
      disposed = true;
      listeners.abort();
      clearTimeout(toastTimer);
      clearTimeout(searchTimer);
      activeScreenAnimation?.cancel();
      root.querySelector("#app").innerHTML = "";
      root.querySelector("#modal-root").innerHTML = "";
    },
  };
}

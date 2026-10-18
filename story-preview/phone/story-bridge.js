/* Scripted presentation adapter. The copied app remains unchanged and offline. */
(() => {
  'use strict';

  const ORIGIN = window.location.origin;
  const SCENES = {
    intro: ['Meet chipin'], groups: ['Your shared groups'],
    budget: ['Set a monthly budget', '$125 per person'],
    invite: ['You are invited', 'Review your contribution', 'Everyone is in'], cards: ['One shared fund'],
    pay: ['Ready to pay', '$64 paid'], split: ['Equally, $16 each', 'A custom split'],
    henry: ['Henry pays for dinner', 'Dinner paid'],
    receipt: ['Receipt attached', 'Scripted Gemini scan', 'Review the item list'],
    claims: ['An item for everyone', 'Connor selects his items', 'Everyone confirmed'],
    clarity: ['Everything in one place'], outro: ['A little less settling up']
  };
  const ROSTER = [
    { id: 'member-0', name: 'Connor', initials: 'CZ', tone: '' },
    { id: 'member-1', name: 'Henry', initials: 'H', tone: 'sam' },
    { id: 'member-2', name: 'Saahil', initials: 'S', tone: 'maya' },
    { id: 'member-3', name: 'Nathan', initials: 'N', tone: 'jordan' }
  ];
  const ITEMS = [
    ['xiaolongbao', 'Pork xiaolongbao', 24], ['wontons', 'Spicy wontons', 26],
    ['noodles', 'Noodles', 22], ['rice', 'Fried rice', 28],
    ['cucumber', 'Cucumber salad', 12], ['tea', 'Tea', 8]
  ].map(([id, name, amount]) => ({ id, name, amount, assignees: [] }));
  const CLAIMS = {
    'member-0': ['xiaolongbao', 'cucumber'], 'member-1': ['wontons', 'tea'],
    'member-2': ['noodles'], 'member-3': ['rice']
  };
  const BASE = {
    state: { ...clone(state), hidden: [], notice: false, displayName: 'Connor' },
    groups: [
      { id: 'apartment', name: 'Apartment', icon: 'home', tone: '', members: 4,
        balance: 0, power: 0, total: 0, budget: 500, period: 'Every month',
        forming: true, defaultSplit: 'equal', people: clone(ROSTER),
        memberBalances: Object.fromEntries(ROSTER.map(person => [person.id, 0])) },
      { id: 'ski', name: 'Ski trip', icon: 'truck', tone: 'purple', members: 4,
        balance: 0, power: 0, total: 0, budget: 600, period: 'Every month',
        forming: true, photo: 'assets/roadtrip.jpg', people: clone(ROSTER),
        memberBalances: Object.fromEntries(ROSTER.map(person => [person.id, 0])) }
    ],
    people: ROSTER, pending: [], charges: [],
    invites: [{ id: 'apartment', name: 'Apartment', from: 'Connor', icon: 'home',
      tone: '', budget: 500, share: 125, members: 4, period: 'Every month' }]
  };
  const receiptSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="620" viewBox="0 0 480 620"><rect width="480" height="620" rx="8" fill="#fffdf8"/><g font-family="monospace" fill="#30343b"><text x="240" y="57" text-anchor="middle" font-size="25" font-weight="bold">DIN TAI FUNG</text><text x="240" y="84" text-anchor="middle" font-size="12">SCRIPTED RECEIPT · OCT 17, 2026</text><path d="M40 110H440" stroke="#b4b4b4" stroke-dasharray="5 5"/>${ITEMS.map((item, i) => `<text x="42" y="${151 + i * 40}" font-size="15">${item.name}</text><text x="438" y="${151 + i * 40}" font-size="15" text-anchor="end">${item.amount.toFixed(2)}</text>`).join('')}<path d="M40 384H440" stroke="#b4b4b4" stroke-dasharray="5 5"/><text x="42" y="420" font-size="16">Subtotal</text><text x="438" y="420" text-anchor="end" font-size="16">120.00</text><text x="42" y="453" font-size="16">Tax</text><text x="438" y="453" text-anchor="end" font-size="16">10.20</text><text x="42" y="486" font-size="16">Tip</text><text x="438" y="486" text-anchor="end" font-size="16">24.00</text><text x="42" y="542" font-size="23" font-weight="bold">TOTAL</text><text x="438" y="542" text-anchor="end" font-size="23" font-weight="bold">154.20</text><text x="240" y="589" text-anchor="middle" font-size="11">THANK YOU FOR SHARING A TABLE</text></g></svg>`;
  const RECEIPT = {
    kind: 'image', name: 'Din Tai Fung — scripted receipt',
    image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(receiptSvg),
    itemSource: 'scripted'
  };
  let active = null;
  let exploring = false;

  function post(message) {
    if (window.parent !== window) window.parent.postMessage(message, ORIGIN);
  }
  function replace(array, value) { array.splice(0, array.length, ...clone(value)); }
  function resetBaseline() {
    clearTimeout(toastTimer);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, clone(BASE.state), { hidden: new Set() });
    replace(groups, BASE.groups); replace(people, BASE.people);
    replace(pending, BASE.pending); replace(charges, BASE.charges); replace(invites, BASE.invites);
    renderedRouteKey = null;
    document.querySelectorAll('.story-overlay').forEach(node => node.remove());
    const modalRoot = document.querySelector('#modal-root');
    if (modalRoot) modalRoot.innerHTML = '';
    document.querySelector('#toast')?.classList.remove('visible');
  }
  function route(type, id) {
    state.tab = ['home', 'groups', 'spending'].includes(type) ? type : 'groups';
    state.stack = ['home', 'groups', 'spending'].includes(type) ? [] : [{ type, id }];
  }
  function fundGroup() {
    Object.assign(gById('apartment'), { forming: false, balance: 125, power: 500,
      memberBalances: Object.fromEntries(ROSTER.map(person => [person.id, 125])) });
    state.invites.apartment = 'accepted';
  }
  function buy(merchant, amount, id, payer) {
    state.paymentResult = null;
    const charge = simulatePayment('apartment', merchant, amount);
    if (charge.error) throw new Error(charge.error);
    charge.id = id;
    charge.paidBy = payer;
    charge.icon = id === 'story-dinner' ? 'coffee' : 'shopping-bag';
    charge.date = id === 'story-dinner' ? 'Oct 17 · 7:42 PM' : 'Oct 17 · 12:18 PM';
    state.paymentResult = id;
    return charge;
  }
  function customizeStore(charge) {
    state.splitDrafts[charge.id] = { ...clone(currentProposal(charge)), method: 'custom', allocation: [24, 16, 12, 12] };
    const result = submitSplitProposal(charge.id);
    if (result.error) throw new Error(result.error);
    delete state.splitDrafts[charge.id];
  }
  // The final storyboard snapshot includes an agreed, settled store purchase.
  // The copied preview has no settlement action: project that fixture into its
  // existing settled ledger, without charging the already-paid card again.
  function recordStoreSettlement(charge) {
    const allocation = currentAllocation(charge), members = chargePeople(charge);
    const cents = allocation.map(moneyCents), total = moneyCents(charge.total);
    if (cents.some(value => value === null) || cents.reduce((sum, value) => sum + value, 0) !== total) {
      throw new Error('The scripted settlement must reconcile to the purchase.');
    }
    const group = gById(charge.group);
    const balances = Object.fromEntries(members.map((person, index) => [person.id,
      (moneyCents(group.memberBalances[person.id]) - cents[index]) / 100]));
    if (Object.values(balances).some(value => value < 0)) throw new Error('The scripted settlement exceeds a member balance.');
    charges.unshift({ id: charge.id, name: charge.name, merchant: charge.merchant,
      group: charge.group, icon: charge.icon, date: 'Oct 17', amount: allocation[0],
      groupAmount: charge.total, memberShares: Object.fromEntries(members.map((person, index) => [person.id, allocation[index]])) });
    pending.splice(pending.findIndex(item => item.id === charge.id), 1);
    group.memberBalances = balances;
    group.balance = balances['member-0'];
    group.total = spendingTotal(9, group.id);
    for (const key of ['approved', 'proposals', 'publishedMethods', 'proposalDetails', 'splitDrafts', 'selectionDrafts', 'itemConfirmations']) {
      delete state[key][charge.id];
    }
  }
  function receiptDraft(charge, scanned) {
    state.splitDrafts[charge.id] = {
      ...clone(currentProposal(charge)), method: 'item', receipt: clone(RECEIPT),
      items: scanned ? clone(ITEMS) : [], tax: scanned ? 10.2 : 0, tip: scanned ? 24 : 0,
      manualEntry: scanned, generation: ++state.draftSequence
    };
  }
  function confirmList(charge) {
    receiptDraft(charge, true);
    const result = confirmItemList(charge.id);
    if (result.error) throw new Error(result.error);
    delete state.splitDrafts[charge.id];
  }
  // The prototype uses roster slot zero as its viewer. Temporarily select a
  // scripted actor, use the real ownership validator, then restore canonical order.
  function claimAs(charge, memberId) {
    const canonical = charge.people;
    charge.people = [...canonical].sort((a, b) => Number(b.id === memberId) - Number(a.id === memberId));
    if (!prepareSelection(charge.id)) throw new Error('Could not prepare the scripted selection.');
    state.selectionDrafts[charge.id].ids = [...CLAIMS[memberId]];
    const result = confirmSelection(charge.id);
    charge.people = canonical;
    if (result.error) throw new Error(result.error);
    const allocation = itemBreakdown(charge, currentProposal(charge)).allocation;
    state.proposalDetails[charge.id].allocation = [...allocation];
    state.proposals[charge.id] = [...allocation];
    state.approved[charge.id] = !!state.itemConfirmations[charge.id]?.['member-0'];
  }
  function build(scene, phase) {
    resetBaseline();
    const index = Object.keys(SCENES).indexOf(scene);
    if (index >= 4 || scene === 'invite' && phase === 2) fundGroup();
    let store, dinner;
    if (index > 5 || scene === 'pay' && phase === 1) store = buy('Corner Store', 64, 'story-store', 'member-0');
    if (store && (index > 6 || scene === 'split' && phase === 1)) customizeStore(store);
    if (index > 7 || scene === 'henry' && phase === 1) dinner = buy('Din Tai Fung', 154.2, 'story-dinner', 'member-1');

    if (scene === 'intro' || scene === 'outro') route('home');
    if (scene === 'groups') route('groups');
    if (scene === 'budget') route(phase ? 'budget' : 'create', 'apartment');
    if (scene === 'invite') { state.displayName = phase === 2 ? 'Connor' : 'Henry'; route(phase === 2 ? 'members' : 'invitations', 'apartment'); }
    if (scene === 'cards') route('group', 'apartment');
    if (scene === 'clarity') route('statistics', 'apartment');
    if (scene === 'pay' || scene === 'henry') {
      state.displayName = scene === 'henry' ? 'Henry' : 'Connor';
      state.paymentResult = phase ? (scene === 'henry' ? dinner.id : store.id) : null;
      route('wallet', 'apartment');
    }
    if (scene === 'split') route('split', store.id);
    if (scene === 'receipt') { receiptDraft(dinner, phase === 2); route('split-edit', dinner.id); }
    if (scene === 'claims' || scene === 'clarity' || scene === 'outro') {
      confirmList(dinner);
      if (scene !== 'claims' || phase > 0) {
        for (const memberId of ['member-1', 'member-2', 'member-3']) claimAs(dinner, memberId);
      }
      if (scene !== 'claims' || phase === 2) claimAs(dinner, 'member-0');
      if (scene === 'claims') {
        if (phase === 1) {
          prepareSelection(dinner.id);
          state.selectionDrafts[dinner.id].ids = [...CLAIMS['member-0']];
          route('select-items', dinner.id);
        } else route('split', dinner.id);
      }
    }
    if (scene === 'clarity' || scene === 'outro') recordStoreSettlement(store);
    state.notice = pending.length > 0;
    render(false, { resetScroll: true });
    decorate(scene, phase);
    document.querySelector('#app').inert = !exploring;
  }

  function screen() { return document.querySelector('.screen'); }
  function append(html) { screen().insertAdjacentHTML('beforeend', html); }
  function peopleRows(caption, amount = 125) {
    return ROSTER.map(person => `<div class="person-row">${avatar(person)}<div class="person-info"><strong>${esc(person.name)}</strong><small>${caption}</small></div><strong>${money(amount)}</strong><span class="story-check">${icon('check')}</span></div>`).join('');
  }
  function setCardNames(name) {
    document.querySelectorAll('.bank-bottom > span').forEach(node => {
      node.innerHTML = `${esc(name.toUpperCase())}<span class="story-card-group">APARTMENT</span>`;
    });
  }
  function decorate(scene, phase) {
    document.body.dataset.storyScene = scene;
    document.body.dataset.storyPhase = String(phase);
    document.body.classList.toggle('story-mode', !exploring);
    setCardNames(state.displayName);
    if (scene === 'intro') {
      document.querySelector('.pending-list').innerHTML = `<section class="story-welcome"><span class="story-welcome-icon">${icon('users')}</span><h2>Your people. Your plans.</h2><p>A shared fund for the everyday things you do together.</p></section>`;
      document.querySelector('.section-heading h2').textContent = 'Start something together';
    }
    if (scene === 'budget' && phase === 0) {
      const form = document.querySelector('[data-form="create"]');
      form.querySelector('[name="name"]').value = 'Apartment';
      form.querySelector('[name="budget"]').value = '500';
      form.querySelector('[name="members"]').value = 'Henry, Saahil, Nathan';
      form.querySelector('[name="period"]').value = 'Every month';
    }
    if (scene === 'budget' && phase === 1) {
      document.querySelector('[data-form="budget"]')?.remove();
      append(`<section class="card-section story-consent"><h2>Four people. One plan.</h2>${peopleRows('Monthly contribution cap')}<p class="form-footnote">Everyone reviews and agrees before the group is funded.</p></section>`);
    }
    if (scene === 'invite' && phase === 0) {
      const group = gById('apartment');
      screen().innerHTML = `${backbar('Invitation')}<div class="story-invite-intro">${stamp(group, 'overview-photo')}<h1>Apartment</h1><p>Connor invited you to share a fund.</p></div><section class="card-section story-invited-members"><h2>Your people</h2>${ROSTER.map(person => `<div class="person-row">${avatar(person)}<div class="person-info"><strong>${esc(person.name)}${person.id === 'member-1' ? ' (you)' : ''}</strong><small>${person.id === 'member-0' ? 'Group creator' : 'Invited'}</small></div></div>`).join('')}</section><section class="story-invite-summary"><span>Shared monthly budget</span><strong>$500.00</strong><small>Review your contribution before joining.</small></section>`;
    }
    if (scene === 'invite' && phase === 2) {
      screen().innerHTML = `${backbar('Your group is ready')}<div class="story-celebration"><div class="success-circle">${icon('check')}</div><h1>Everyone is in.</h1><p>Four approved contributions.</p></div><section class="card-section story-consent">${peopleRows('Agreed to contribute')}</section><section class="story-fund-total"><span>Group buying power</span><strong>$500.00</strong><small>$125 × 4 people</small></section>`;
    }
    if (scene === 'cards') {
      document.querySelector('.list-menu')?.remove();
      document.querySelector('.group-inline-history')?.remove();
      append(`<section class="story-card-holders"><span class="eyebrow">A card for everyone</span><div>${ROSTER.map(person => `<span>${avatar(person)}<small>${esc(person.name)}</small></span>`).join('')}</div></section>`);
    }
    if (scene === 'pay' || scene === 'henry') {
      const merchant = scene === 'henry' ? 'Din Tai Fung' : 'Corner Store';
      const amount = scene === 'henry' ? 154.2 : 64;
      const input = document.querySelector('[name="amount"]');
      if (input) input.value = amount.toFixed(2);
      const merchantLabel = document.querySelector('.wallet-amount-widget small') || document.querySelector('.payment-success > p');
      if (merchantLabel) merchantLabel.textContent = merchant;
      const paymentButton = document.querySelector('.payment-button');
      if (paymentButton) paymentButton.textContent = 'Pay ' + money(amount);
      if (phase) {
        const info = document.querySelector('.native-success .info-text');
        if (info) info.innerHTML = `Group buying power <strong class="story-payment-balance">${money(gById('apartment').power)}</strong>`;
      }
    }
    if (scene === 'receipt') {
      document.querySelector('.backbar strong').textContent = 'Din Tai Fung receipt';
      if (phase < 2) {
        const editor = document.querySelector('.item-editor');
        editor.innerHTML = `<div class="row"><h2>Receipt uploaded</h2><span class="pill">$154.20</span></div><div class="story-receipt-sheet"><img src="${esc(RECEIPT.image)}" alt="Scripted Din Tai Fung receipt totaling $154.20">${phase === 1 ? '<span class="story-scan-beam" aria-hidden="true"></span>' : ''}</div><div class="story-scan-caption">${phase === 1 ? `<span class="story-scan-orbit" aria-hidden="true"></span><div><strong>Gemini is reading the receipt</strong><small>Scripted scan · no upload or AI request</small></div>` : `${icon('check-circle')}<div><strong>Ready to read the receipt</strong><small>Image attached for reference</small></div>`}</div>`;
      } else {
        const editor = document.querySelector('.item-editor');
        editor.querySelector('.row').insertAdjacentHTML('afterend', '<p class="story-extraction-note">Scripted scan complete · review all 6 items</p>');
      }
    }
    if (scene === 'claims' && phase === 2) {
      const banner = document.querySelector('.status-banner');
      if (banner) banner.innerHTML = `${icon('check-circle')}<span>Everyone confirmed their items.</span>`;
    }
  }

  function updateStoryScroll(scene, phase, progress) {
    const range = scene === 'claims' && phase === 2 || scene === 'receipt' && phase === 2
      ? [0.72, 0.95] : scene === 'clarity' ? [0.6, 0.9] : null;
    if (!range) return;
    const target = screen();
    if (!target || !Number.isFinite(target.scrollHeight) || !Number.isFinite(target.clientHeight)) return;
    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
    const fraction = Math.max(0, Math.min(1, (progress - range[0]) / (range[1] - range[0])));
    const eased = fraction * fraction * (3 - 2 * fraction);
    const nextScroll = Math.round(maxScroll * eased);
    if (target.scrollTop === nextScroll) return;
    target.scrollTop = nextScroll;
    state.scroll[routeKey()] = target.scrollTop;
    // Keep the existing sticky-share treatment in sync with scripted scrolling.
    if (target.dispatchEvent && typeof Event === 'function') target.dispatchEvent(new Event('scroll'));
  }
  function setScene(scene, progress = 0, force = false) {
    if (!Object.hasOwn(SCENES, scene) || !Number.isFinite(progress)) return false;
    const phase = Math.min(SCENES[scene].length - 1, Math.floor(Math.max(0, Math.min(1, progress)) * SCENES[scene].length + 1e-7));
    const unchanged = active?.scene === scene && active.phase === phase;
    active = { scene, phase, progress, label: SCENES[scene][phase] };
    if (exploring) return false;
    if (unchanged && !force) {
      updateStoryScroll(scene, phase, progress);
      return false;
    }
    build(scene, phase);
    updateStoryScroll(scene, phase, progress);
    post({ type: 'chipin-story-state', scene, phase, label: active.label });
    return true;
  }
  function setExplore(enabled) {
    if (typeof enabled !== 'boolean' || enabled === exploring) return;
    exploring = enabled;
    if (enabled) {
      document.body.classList.remove('story-mode');
      delete document.body.dataset.storyScene;
      delete document.body.dataset.storyPhase;
      state.displayName = 'Connor';
      state.splitDrafts = {};
      state.selectionDrafts = {};
      state.paymentResult = null;
      route('home');
      render(false, { resetScroll: true });
      document.querySelector('#app').inert = false;
    } else if (active) setScene(active.scene, active.progress, true);
    post({ type: 'chipin-story-explore-state', enabled });
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== ORIGIN || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'chipin-story') setScene(event.data.scene, event.data.progress, event.data.force === true);
    if (event.data.type === 'chipin-story-explore') setExplore(event.data.enabled);
  });
  window.addEventListener('keydown', event => {
    if (exploring && event.key === 'Escape') {
      event.preventDefault();
      setExplore(false);
      post({ type: 'chipin-story-exit-explore' });
    }
  });
  window.chipinStory = Object.freeze({
    setScene, setExplore, reset: () => { exploring = false; setScene('intro', 0, true); },
    getState: () => ({ ...active, exploring, buyingPower: gById('apartment').power,
      personalSpending: spendingTotal(9), memberBalances: clone(gById('apartment').memberBalances),
      settled: clone(charges),
      pending: pending.map(charge => ({ id: charge.id, total: charge.total, allocation: [...currentAllocation(charge)] })) })
  });
  setScene('intro', 0, true);
  post({ type: 'chipin-story-ready' });
})();

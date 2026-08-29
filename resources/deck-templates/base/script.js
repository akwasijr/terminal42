// Deck template engine.
// Horizontal scroll-snap nav, wheel-to-horizontal, word-stagger reveal,
// scroll-linked parallax on background pictograms, pictogram injection.
(() => {
  const deck = document.querySelector('.deck');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const dotsWrap = document.querySelector('.dots');
  const navNudge = document.querySelector('.nav-nudge');

  // Clicking the brand mark returns to the first slide.
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.addEventListener('click', () => {
      slides[0].scrollIntoView({ behavior: 'smooth', inline: 'start' });
    });
  }

  // Inject pictogram SVGs.
  document.querySelectorAll('[data-picto]').forEach((el) => {
    const key = el.dataset.picto;
    if (window.S42_ICONS && window.S42_ICONS[key]) el.innerHTML = window.S42_ICONS[key];
  });

  // Build the hub-and-spoke diagram (only runs if a .diagram element exists).
  function buildDiagram() {
    const diagram = document.querySelector('.diagram');
    if (!diagram) return;
    const svg = diagram.querySelector('svg.paths');
    // Nodes down each side of the hub. [label, pictogram key]
    const left = [
      ['Node one', 'insight'],
      ['Node two', 'build'],
      ['Node three', 'vision'],
      ['Node four', 'story'],
      ['Node five', 'explore'],
    ];
    const right = [
      ['Node six', 'solution'],
      ['Node seven', 'case'],
      ['Node eight', 'hub'],
      ['Node nine', 'trust'],
      ['Node ten', 'proto'],
    ];
    // Detail shown when a node is clicked. Key = the node label.
    const prompts = {};
    const n = left.length;
    const step = 36 / (n - 1);
    const glowPaths = [];
    const linePaths = [];
    const flowPaths = [];
    const nodeEls = [];
    let idx = 0;

    const addSide = (items, x1, gradient, side) => {
      items.forEach(([name, icon], i) => {
        const y = 2 + i * step;
        const d = side === 'left'
          ? `M${x1},${y} C 26,${y} 26,20 50,20`
          : `M${x1},${y} C 74,${y} 74,20 50,20`;
        glowPaths.push(`<path class="path-glow" data-idx="${idx}" d="${d}" pathLength="100" fill="none" stroke="url(#${gradient})" stroke-width="1.6"/>`);
        linePaths.push(`<path class="path-line" data-idx="${idx}" d="${d}" pathLength="100" fill="none" stroke="url(#${gradient})" stroke-width="0.8" style="transition-delay:${idx * 90}ms"/>`);
        flowPaths.push(`<path class="path-flow" data-idx="${idx}" d="${d}" pathLength="100" fill="none" stroke="url(#lgFlow)" stroke-width="1" style="animation-delay:${idx * -260}ms"/>`);
        const pos = side === 'left' ? `left:2%;` : `right:2%;`;
        nodeEls.push(`<button type="button" class="node${side === 'right' ? ' right' : ''}" data-idx="${idx}" data-name="${name}" style="${pos} top:${(y / 40) * 100}%; --ty:-50%; transition-delay:${idx * 110}ms"><span class="picto" data-picto="${icon}"></span><span class="name">${name}</span></button>`);
        idx += 1;
      });
    };
    addSide(left, 4, 'lgL', 'left');
    addSide(right, 96, 'lgR', 'right');

    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    svg.appendChild(defs);
    svg.insertAdjacentHTML('beforeend', glowPaths.join('') + linePaths.join('') + flowPaths.join(''));
    diagram.querySelectorAll('.node').forEach((n) => n.remove());
    diagram.insertAdjacentHTML('beforeend', nodeEls.join(''));

    // Inject pictograms for the newly created nodes.
    diagram.querySelectorAll('[data-picto]').forEach((el) => {
      const key = el.dataset.picto;
      if (window.S42_ICONS && window.S42_ICONS[key]) el.innerHTML = window.S42_ICONS[key];
    });

    // Click an industry to spotlight its connection and reveal discussion prompts
    // positioned directly under (or above, near the bottom) the clicked node.
    const detail = diagram.querySelector('.diagram-detail');
    const detailPicto = detail ? detail.querySelector('.picto') : null;
    const detailList = detail ? detail.querySelector('ul') : null;
    const detailClose = detail ? detail.querySelector('.detail-close') : null;
    const nodes = Array.from(diagram.querySelectorAll('.node'));
    const closeDetail = () => {
      nodes.forEach((n) => n.classList.remove('active'));
      diagram.querySelectorAll('[data-idx]').forEach((el) => el.classList.remove('active'));
      diagram.classList.remove('has-active');
      if (detail) detail.classList.remove('show');
    };
    if (detailClose) detailClose.addEventListener('click', (e) => { e.stopPropagation(); closeDetail(); });
    nodes.forEach((node) => {
      node.addEventListener('click', () => {
        const already = node.classList.contains('active');
        const i = node.dataset.idx;
        if (already) {
          closeDetail();
        } else {
          nodes.forEach((n) => n.classList.remove('active'));
          diagram.querySelectorAll('[data-idx]').forEach((el) => el.classList.remove('active'));
          node.classList.add('active');
          diagram.querySelectorAll(`[data-idx="${i}"]`).forEach((el) => el.classList.add('active'));
          diagram.classList.add('has-active');
          if (detail) {
            const name = node.dataset.name;
            const groups = prompts[name] || { shortTerm: [], longTerm: [] };
            const totalCount = groups.shortTerm.length + groups.longTerm.length;
            if (detailPicto) detailPicto.innerHTML = node.querySelector('.picto').innerHTML;
            if (detailList) {
              const group = (label, items) => items.length
                ? `<li class="group-label">${label}</li>` + items.map((q) => `<li>${q}</li>`).join('')
                : '';
              detailList.innerHTML = group('Short to mid term', groups.shortTerm)
                + group('Long term', groups.longTerm);
            }

            // Position the card directly beneath the node; flip above it if
            // there isn't enough room below within the diagram.
            const diagramH = diagram.clientHeight;
            const diagramW = diagram.clientWidth;
            const nodeTop = node.offsetTop;
            const nodeBottom = nodeTop + node.offsetHeight;
            const estCardH = 90 + totalCount * 34;
            const placeBelow = nodeBottom + 14 + estCardH <= diagramH;
            detail.classList.toggle('above', !placeBelow);
            detail.style.top = placeBelow ? `${nodeBottom + 14}px` : 'auto';
            detail.style.bottom = placeBelow ? 'auto' : `${diagramH - nodeTop + 14}px`;
            if (node.classList.contains('right')) {
              detail.style.right = `${diagramW - (node.offsetLeft + node.offsetWidth)}px`;
              detail.style.left = 'auto';
            } else {
              detail.style.left = `${node.offsetLeft}px`;
              detail.style.right = 'auto';
            }
            detail.classList.add('show');
          }
        }
      });
    });
  }
  buildDiagram();

  // Clickable deliverable tiles — click to surface richer detail on what each ships.
  // Tip 10 — AI defaults, and what to ask for instead.
  // Content for the clickable tile list on the "Clickable list" slide.
  // Key must match the tile's data-name in index.html.
  //   picto     — a key from pictograms.js (insight, build, vision, story, ...)
  //   img       — optional screenshot shown inside the detail panel
  //   questions — the lines listed in the panel
  const itemDetails = {
    'Item one': {
      picto: 'insight',
      img: 'images/placeholder.svg',
      questions: [
        'What this item is, in one plain sentence.',
        'What to do about it instead.',
      ],
    },
    'Item two': {
      picto: 'build',
      img: 'images/placeholder.svg',
      questions: [
        'What this item is, in one plain sentence.',
        'What to do about it instead.',
      ],
    },
    'Item three': {
      picto: 'vision',
      img: 'images/placeholder.svg',
      questions: [
        'What this item is, in one plain sentence.',
        'What to do about it instead.',
      ],
    },
    'Item four': {
      picto: 'story',
      img: 'images/placeholder.svg',
      questions: [
        'What this item is, in one plain sentence.',
        'What to do about it instead.',
      ],
    },
    'Item five': {
      picto: 'solution',
      img: 'images/placeholder.svg',
      questions: [
        'What this item is, in one plain sentence.',
        'What to do about it instead.',
      ],
    },
    'Item six': {
      picto: 'explore',
      img: 'images/placeholder.svg',
      questions: [
        'What this item is, in one plain sentence.',
        'What to do about it instead.',
      ],
    },
  };
  function wireDetailGroup(groupSelector, itemSelector, detailsMap) {
    document.querySelectorAll(groupSelector).forEach((group) => {
      const panel = group.parentElement.querySelector('.tile-detail');
      if (!panel) return;
      const panelPicto = panel.querySelector('.picto');
      const heading = panel.querySelector('h4');
      const list = panel.querySelector('ul');
      const closeBtn = panel.querySelector('.detail-close');
      const items = Array.from(group.querySelectorAll(itemSelector));
      const closePanel = () => {
        items.forEach((t) => t.classList.remove('active'));
        panel.classList.remove('show');
        group.classList.remove('detail-open');
      };
      if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
      items.forEach((item) => {
        item.addEventListener('click', () => {
          const already = item.classList.contains('active');
          if (already) {
            closePanel();
          } else {
            items.forEach((t) => t.classList.remove('active'));
            item.classList.add('active');
            const name = item.dataset.name;
            const info = detailsMap[name] || { desc: '', questions: [] };
            if (panelPicto && window.S42_ICONS && window.S42_ICONS[info.picto]) panelPicto.innerHTML = window.S42_ICONS[info.picto];
            if (heading) heading.textContent = name;
            if (list) {
              if (info.groups) {
                const group = (label, entries) => entries.length
                  ? `<li class="group-label">${label}</li>` + entries.map((q) => `<li>${q}</li>`).join('')
                  : '';
                list.innerHTML = group('Short-term', info.groups.shortTerm || []) + group('Long-term', info.groups.longTerm || []);
              } else {
                list.innerHTML = (info.questions || []).map((q) => `<li>${q}</li>`).join('');
              }
            }
            if (info.img) {
              let shot = panel.querySelector('.detail-shot');
              if (!shot) {
                shot = document.createElement('img');
                shot.className = 'detail-shot';
                shot.alt = '';
                (list && list.parentElement ? list.parentElement : panel).appendChild(shot);
              }
              shot.src = info.img;
              shot.hidden = false;
            } else {
              const shot = panel.querySelector('.detail-shot');
              if (shot) shot.hidden = true;
            }
            panel.classList.add('show');
            group.classList.add('detail-open');
          }
        });
      });
      // the AI-defaults list opens on the first item rather than an empty panel
      if (group.classList.contains('tiles-list') && items.length) items[0].click();
    });
  }
  wireDetailGroup('.tiles', '.tile', itemDetails);

  // sliding indicator for the AI-defaults list
  (function tabThumb() {
    const list = document.querySelector('.tiles-list');
    if (!list) return;
    const thumb = document.createElement('span');
    thumb.className = 'tab-thumb';
    list.appendChild(thumb);
    const sync = () => {
      const active = list.querySelector('.tile.active');
      if (!active) { thumb.classList.remove('show'); return; }
      thumb.style.transform = 'translateY(' + active.offsetTop + 'px)';
      thumb.style.height = active.offsetHeight + 'px';
      thumb.classList.add('show');
    };
    new MutationObserver((muts) => {
      if (muts.every((m) => m.target === thumb)) return;
      sync();
    }).observe(list, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', sync);
    sync();
  })();

  // Content for the folder-stack layout (not used by the starter slides).
  // Key = the folder tab's data-name. Each entry is [label, text].
  const folderDetails = {
    'Folder one': [
      ['Label', 'Placeholder text for this folder tab.'],
    ],
  };

  // Multiple folder tabs share each colored band, matching the reference.
  document.querySelectorAll('.folder-stack').forEach((stack) => {
    const bands = Array.from(stack.querySelectorAll('.folder-band'));
    const render = (band, tab) => {
      const list = band.querySelector('.folder-panel ul');
      const details = folderDetails[tab.dataset.name] || [];
      list.innerHTML = details.flatMap(([label, text]) => [
        `<li class="group-label">${label}</li>`,
        `<li>${text}</li>`,
      ]).join('');
    };

    bands.forEach((band) => {
      const tabs = Array.from(band.querySelectorAll('.folder-tab'));
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          bands.forEach((otherBand) => {
            otherBand.classList.remove('open');
            otherBand.querySelectorAll('.folder-tab').forEach((otherTab) => {
              otherTab.classList.remove('active');
              otherTab.setAttribute('aria-expanded', 'false');
            });
          });
          band.classList.add('open');
          tab.classList.add('active');
          tab.setAttribute('aria-expanded', 'true');
          render(band, tab);
        });
      });
    });

    const initial = stack.querySelector('.folder-tab.active');
    if (initial) render(initial.closest('.folder-band'), initial);
  });

  // Clickable timeline rows — click to expand what happens that phase.
  // The row itself stays a plain div (its accessible toggle control is the
  // "Kickoff"/"Explore"/etc. button) so the draggable resize handle below
  // is never nested inside another interactive control.
  const trows = Array.from(document.querySelectorAll('.trow'));
  trows.forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('.gantt-handle')) return;
      const already = row.classList.contains('active');
      trows.forEach((r) => r.classList.remove('active'));
      if (!already) row.classList.add('active');
    });
  });

  // Timeline slide — draggable phase durations. The four phases (Kickoff,
  // Explore, Build, Present) share one fixed-length timeline (4 weeks by
  // default). Dragging a phase's handle stretches it and shrinks the very
  // next phase by the same amount, so the overall timeframe never changes.
  (function () {
    const ganttEl = document.querySelector('.timeline.gantt');
    if (!ganttEl) return;
    const totalWeeks = Number(ganttEl.dataset.totalWeeks) || 4;
    const trackEls = Array.from(ganttEl.querySelectorAll('.gantt-track'));
    const handleEls = Array.from(ganttEl.querySelectorAll('.gantt-handle'));
    if (!trackEls.length) return;

    // Default emphasis: short kickoff and present, longer explore and build.
    const weeks = [0.5, 1.5, 1.5, 0.5];
    const minWeeks = 0.35;

    function render() {
      let cursor = 0;
      weeks.forEach((w, i) => {
        const startPct = (cursor / totalWeeks) * 100;
        const widthPct = (w / totalWeeks) * 100;
        trackEls[i].style.setProperty('--bar-start', startPct.toFixed(3));
        trackEls[i].style.setProperty('--bar-width', widthPct.toFixed(3));
        cursor += w;
      });
      handleEls.forEach((handle) => {
        const i = Number(handle.dataset.handleIndex);
        handle.setAttribute('aria-valuenow', weeks[i].toFixed(2));
      });
    }

    function setPair(index, nextA) {
      const pairTotal = weeks[index] + weeks[index + 1];
      const clampedA = Math.min(pairTotal - minWeeks, Math.max(minWeeks, nextA));
      weeks[index] = clampedA;
      weeks[index + 1] = pairTotal - clampedA;
      render();
    }

    handleEls.forEach((handle) => {
      const index = Number(handle.dataset.handleIndex);
      let dragging = false;
      let startX = 0;
      let startWeeksA = 0;
      let trackWidth = 0;

      handle.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        event.preventDefault();
        dragging = true;
        startX = event.clientX;
        startWeeksA = weeks[index];
        trackWidth = trackEls[index].getBoundingClientRect().width;
        document.body.classList.add('resizing-gantt');
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const deltaWeeks = ((event.clientX - startX) / trackWidth) * totalWeeks;
        setPair(index, startWeeksA + deltaWeeks);
      });
      const endDrag = () => {
        dragging = false;
        document.body.classList.remove('resizing-gantt');
      };
      handle.addEventListener('pointerup', endDrag);
      handle.addEventListener('pointercancel', endDrag);
      handle.addEventListener('click', (event) => event.stopPropagation());
      handle.addEventListener('keydown', (event) => {
        const step = 0.25;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          setPair(index, weeks[index] + step);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          setPair(index, weeks[index] - step);
        }
      });
    });

    render();
  })();

  // Investment slide — interactive pilot-industries + people-per-pod steppers
  // recalculate hrs/week live: total = core V-Team hours + (pods × people/pod × hrs/person).
  const podsStepper = document.querySelector('.calc-stepper[data-calc-role="pods"]');
  const peopleStepper = document.querySelector('.calc-stepper[data-calc-role="people"]');
  if (podsStepper && peopleStepper) {
    const coreHours = Number(podsStepper.dataset.coreHours);
    const hrsPerPerson = Number(podsStepper.dataset.hrsPerPerson);
    const podsMin = Number(podsStepper.dataset.podsMin);
    const podsMax = Number(podsStepper.dataset.podsMax);
    let pods = Number(podsStepper.dataset.pods) || podsMin;

    const peopleMin = Number(peopleStepper.dataset.peopleMin);
    const peopleMax = Number(peopleStepper.dataset.peopleMax);
    let peoplePerPod = Number(peopleStepper.dataset.people) || peopleMin;

    const headline = document.querySelector('.calc-headline');
    const podsEls = document.querySelectorAll('.calc-pods');
    const podsSuffixEls = document.querySelectorAll('.calc-pods-suffix');
    const peopleEls = document.querySelectorAll('.calc-people');
    const segB = document.querySelector('.barrow .seg.b');
    const segBLabel = document.querySelector('.calc-seg-b-label');
    const segBTotal = document.querySelector('.calc-seg-b-total');
    const podsMinusBtn = podsStepper.querySelector('.calc-btn-minus');
    const podsPlusBtn = podsStepper.querySelector('.calc-btn-plus');
    const peopleMinusBtn = peopleStepper.querySelector('.calc-btn-minus');
    const peoplePlusBtn = peopleStepper.querySelector('.calc-btn-plus');

    function render() {
      const podHours = pods * peoplePerPod * hrsPerPerson;
      const total = coreHours + podHours;
      const industryWord = pods === 1 ? 'industry' : 'industries';
      const podWord = pods === 1 ? 'pod' : 'pods';
      const personWord = peoplePerPod === 1 ? 'person' : 'people';

      if (headline) headline.textContent = `~${total} hrs a week, for ${pods} pilot ${industryWord}.`;
      podsEls.forEach((el) => { el.textContent = pods; });
      podsSuffixEls.forEach((el) => { el.textContent = pods === 1 ? '' : 's'; });
      peopleEls.forEach((el) => { el.textContent = peoplePerPod; });
      if (segB) segB.style.setProperty('--seg-flex', podHours);
      if (segBLabel) segBLabel.textContent = `${pods} pilot ${podWord} × ${peoplePerPod} ${personWord} × ${hrsPerPerson} hrs/week`;
      if (segBTotal) segBTotal.textContent = `~${podHours} hrs/week`;

      if (podsMinusBtn) podsMinusBtn.disabled = pods <= podsMin;
      if (podsPlusBtn) podsPlusBtn.disabled = pods >= podsMax;
      if (peopleMinusBtn) peopleMinusBtn.disabled = peoplePerPod <= peopleMin;
      if (peoplePlusBtn) peoplePlusBtn.disabled = peoplePerPod >= peopleMax;
    }

    if (podsMinusBtn) podsMinusBtn.addEventListener('click', () => {
      pods = Math.max(podsMin, pods - 1);
      render();
    });
    if (podsPlusBtn) podsPlusBtn.addEventListener('click', () => {
      pods = Math.min(podsMax, pods + 1);
      render();
    });
    if (peopleMinusBtn) peopleMinusBtn.addEventListener('click', () => {
      peoplePerPod = Math.max(peopleMin, peoplePerPod - 1);
      render();
    });
    if (peoplePlusBtn) peoplePlusBtn.addEventListener('click', () => {
      peoplePerPod = Math.min(peopleMax, peoplePerPod + 1);
      render();
    });

    render();
  }

  // Timeline slide — start-date picker recalculates each week's displayed
  // date range (5-day work week: Mon–Fri, one week apart).
  const startDateInput = document.getElementById('timeline-start-date');
  const weekRangeEls = Array.from(document.querySelectorAll('.gantt-weeks .wk-range'));
  if (startDateInput && weekRangeEls.length) {
    const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });

    function formatRange(start, end) {
      const startMonth = monthFmt.format(start);
      const endMonth = monthFmt.format(end);
      return startMonth === endMonth
        ? `${startMonth} ${start.getDate()}–${end.getDate()}`
        : `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
    }

    function renderTimeline() {
      const [y, m, d] = startDateInput.value.split('-').map(Number);
      if (!y || !m || !d) return;
      weekRangeEls.forEach((el, i) => {
        const weekStart = new Date(y, m - 1, d + i * 7);
        const weekEnd = new Date(y, m - 1, d + i * 7 + 4);
        el.textContent = formatRange(weekStart, weekEnd);
      });
    }

    startDateInput.addEventListener('change', renderTimeline);
    renderTimeline();
  }

  // Wrap each word of headline text in its own span for staggered reveal.
  function wrapWords() {
    document.querySelectorAll('.display').forEach((h) => {
      const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);
      textNodes.forEach((tn) => {
        const parts = tn.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (part.trim() === '') {
            frag.appendChild(document.createTextNode(part));
          } else {
            const mask = document.createElement('span');
            mask.className = 'wmask';
            const span = document.createElement('span');
            span.className = 'w';
            span.textContent = part;
            mask.appendChild(span);
            frag.appendChild(mask);
          }
        });
        tn.parentNode.replaceChild(frag, tn);
      });
    });
    document.querySelectorAll('.display').forEach((h) => {
      h.querySelectorAll('.w').forEach((w, i) => w.style.setProperty('--i', i));
    });
  }
  wrapWords();

  // Nav dots.
  const goToSlide = (s) => {
    const current = slides.find((slide) => slide.classList.contains('in-view'));
    if (current?.dataset.title === 'Industries' && s.dataset.title === 'Operating model') prepareOrbCarry();
    s.scrollIntoView({ behavior: 'smooth', inline: 'start' });
  };
  slides.forEach((s, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', s.dataset.title || `Slide ${i + 1}`);
    const tipNum = (s.dataset.title || '').match(/^(\d+)\s*·/);
    if (tipNum) b.dataset.num = tipNum[1];
    b.addEventListener('click', () => goToSlide(s));
    dotsWrap.appendChild(b);
  });
  const dotEls = Array.from(dotsWrap.children);

  // Table of contents that opens off the pagination.
  const toc = document.querySelector('.toc');
  const tocList = toc?.querySelector('.toc-list');
  const tocItems = [];
  if (toc && tocList) {
    slides.forEach((s, i) => {
      const raw = s.dataset.title || `Slide ${i + 1}`;
      const parts = raw.match(/^(\d+)\s*·\s*(.+)$/);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toc-item' + (parts ? '' : ' is-section');
      const n = document.createElement('span');
      n.className = 'toc-n';
      n.textContent = parts ? `${parts[1]}.` : '';
      n.setAttribute('aria-hidden', 'true');
      const t = document.createElement('span');
      t.textContent = parts ? parts[2] : raw;
      b.append(n, t);
      b.addEventListener('click', () => { goToSlide(s); closeToc(); });
      li.appendChild(b);
      tocList.appendChild(li);
      tocItems.push(b);
    });
  }

  // Ready-made prompt for each tip.
  const tipPrompts = {
    1: "Do not build this in one go. We work in steps, and you stop for my\nfeedback after each one.\n\nContext\nI am building [what it is] for [who uses it]. The main thing someone\ncomes here to do is [primary task]. It will be used mostly on\n[desktop / mobile].\n\nStyle\nKeep it [calm and dense / spacious and simple / plain and utilitarian].\nMain colour [#______], background [#______], text [#______].\nSpacing on a 4px grid. Body text [14px]. Corners [8px].\n\nStep 1. List the screens and what each one is for. Then stop.\nStep 2. Build the layout and spacing for [first screen] only.\nGreyscale, no real content yet. Then stop.\nStep 3. Add the type scale and the real content. Then stop.\nStep 4. Add colour, then hover, focus and empty states.\n\nIf anything above is missing or unclear, ask me before you start.",
    2: "Before you build any screen, set the foundations with me.\nWork through these in order and stop after each step.\n\nStep 1. Colour\nBackground [#______], surface [#______], text [#______],\nmuted text [#______], primary action [#______], border [#______].\nPlus a success, warning and error colour.\n\nStep 2. Type\nOne font: [font name]. Body [14px], line height [1.5].\nGive me a scale with [4] sizes, from caption up to page title.\n\nStep 3. Spacing and shape\nSpacing on a [4px] grid. Corners [8px]. Border [1px].\n\nStep 4. Put all of the above in one tokens file, then use those\ntokens everywhere. No hard-coded colours or pixel values in the\ncomponents.\n\nIf I have left something blank, propose a value, tell me why,\nand wait for me to confirm. Show me the tokens before you build.",
    3: "Keep this consistent with the rest of the project. Do not invent\na new pattern when one already exists.\n\nReuse whatever is already defined for:\nnavigation, buttons, form fields, tables, spacing, type sizes,\nicon style, and empty and loading states.\n\nThese must look and behave the same on every screen:\n[anything specific, eg. button height, page padding,\nwhere the primary action sits, date and number format]\n\nIf a pattern does not exist yet, do not guess. Either ask me, or\ngive me two options and wait for me to pick one.\n\nWhen you are done, list anything you introduced that was not\nalready in the project, and why you needed it.",
    4: "Build this using the Fluent design system (or Material, or Carbon). Follow its spacing, type scale and component specifications instead of inventing your own.",
    5: "Here is a screenshot of a UI I like. Match its density, spacing and type hierarchy in my project. Do not copy its content or brand colours, only the structure and the restraint.",
    6: "Use these exact values. Do not round them or swap in your own.\n\nSpacing on a [4px] grid.\nPage padding [32px]. Card padding [24px]. Gap between cards [16px].\n\nBody text [14px], line height [1.5]. Page title [24px].\nCorners [8px]. Border [1px] in [#______].\n\nPrimary action [#______] on [#______].\nBackground [#______]. Text [#______]. Muted text [#______].\n\nKeep every text and background pair above [4.5:1] contrast.\n\nIf I have left a value blank, propose one, tell me the number you\npicked and why, then wait for me to confirm.",
    7: "Check this screen for accessibility. Show me what fails before\nyou change anything.\n\nLook for:\nText and background pairs under 4.5:1. Light text on a light\nbutton, mid grey on white, or white on a pale colour.\nText sitting on an image or gradient, where contrast shifts.\nButtons and links with no visible focus ring when I tab to them.\nTap targets under 44px, or icon-only buttons with no label.\nColour carrying meaning on its own, for example a red and a green\nstatus dot with no text or shape to tell them apart.\nPlaceholder text used in place of a real label.\nDisabled controls too faint to read.\n\nFor each one, tell me what it is, where it is, the measured\nnumber, and the fix. Then wait for me.",
    8: "Before writing any code, plan this with me.\n\nFirst, interview me. Ask me anything you need in order to plan\nthis properly. One question at a time, and wait for my answer\nbefore the next one. Keep going until you have enough. Do not\nassume, and do not start early.\n\nWhat I know so far:\nThe product is [what it is], for [who uses it].\nThe main thing they come here to do is [primary task].\n\nThen show me:\nThe list of pages, and what each one is for\nHow someone moves between them\nThe one primary action on each screen\nAnything you think we do not need at all\n\nWait for my approval before you build.",
    9: "Explain the visual hierarchy on this screen: what someone should see first, second and third, and how colour supports that. Then cut it down to one primary action and make everything else secondary.",
    10: "Review this screen and list anything a user does not need in order to understand the page or take an action. Tell me what to remove outright and what to move behind a button.",
    11: "Avoid the usual AI defaults. Do not do any of the following.\n\nBoxes and depth\nNo outline around every box. Separate regions with spacing and\nbackground tone instead.\nNo heavy shadows. Opacity under 0.12, blur under 12px, offset no\nmore than 4px.\nNever put an outline and a deep shadow on the same box. Pick one.\n\nColour\nNo gradient backgrounds, especially on a dense working screen.\nNo gradients on small things like buttons, badges or icons.\nNo rainbow or glowing hover effects. A small background or border\nchange is enough.\n\nIcons\nNo box around every icon.\nNo emoji standing in for icons. Use a real icon set.\nNo icon on every list item, nav row and table cell.\n\nText\nNo all-caps headings with wide letter spacing.\nNo subtext under every title. Only add one if it says something new.\nNo text everywhere. Cut anything nobody needs to read.\nNo generic hero copy of the \"Supercharge your workflow\" kind.\n\nLayout\nNo accent underline or coloured bar under every heading.\nNo full-viewport hero by default.\nNo page that scrolls as one block. Keep the sidebar in place and\nscroll only the content.\nNo default landing page shape: nav, gradient hero, three feature\ncards, testimonials, call to action, footer.\n\nContent\nNo invented testimonials, names or profile photos.\nNo tilted fake dashboard screenshots.\nNo abstract blobs, wavy dividers or floating shapes as filler.\n\nIf you think one of these is genuinely right here, ask me first."
  };
  const promptBar = document.querySelector('.promptbar');
  const promptToggle = promptBar?.querySelector('.prompt-toggle');
  const promptPanel = promptBar?.querySelector('.prompt-panel');
  const promptText = promptBar?.querySelector('.prompt-text');
  const promptCopy = promptBar?.querySelector('.prompt-copy');
  let copyTimer = null;

  const closePrompt = () => {
    if (!promptPanel) return;
    promptPanel.classList.remove('open');
    promptPanel.setAttribute('inert', '');
    promptPanel.setAttribute('aria-hidden', 'true');
    promptToggle.setAttribute('aria-expanded', 'false');
  };
  const openPrompt = () => {
    if (!promptPanel) return;
    promptPanel.classList.add('open');
    promptPanel.removeAttribute('inert');
    promptPanel.setAttribute('aria-hidden', 'false');
    promptToggle.setAttribute('aria-expanded', 'true');
  };
  const syncPrompt = (slide) => {
    if (!promptBar) return;
    const num = slide?.dataset.title?.match(/^(\d+)\s*·/)?.[1];
    const text = num ? tipPrompts[num] : null;
    closePrompt();
    if (!text) { promptBar.hidden = true; return; }
    promptBar.hidden = false;
    promptText.textContent = text;
    promptToggle.setAttribute('aria-label', `Show the prompt for tip ${num}`);
  };
  if (promptBar) {
    promptToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      promptPanel.classList.contains('open') ? closePrompt() : openPrompt();
    });
    promptCopy.addEventListener('click', async () => {
      const text = promptText.textContent;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* nothing else to try */ }
        ta.remove();
      }
      promptCopy.textContent = 'Copied';
      promptCopy.classList.add('done');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        promptCopy.textContent = 'Copy';
        promptCopy.classList.remove('done');
      }, 1600);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && promptPanel.classList.contains('open')) closePrompt();
    });
    document.addEventListener('click', (e) => {
      if (promptPanel.classList.contains('open') && !promptBar.contains(e.target)) closePrompt();
    });
  }

  let tocPinned = false;
  let tocTimer = null;
  const tocOpen = () => !!toc?.classList.contains('open');
  const openToc = () => {
    if (!toc || tocOpen()) return;
    clearTimeout(tocTimer);
    toc.classList.add('open');
    toc.removeAttribute('inert');
    toc.setAttribute('aria-hidden', 'false');
    const cur = tocItems.find((b) => b.classList.contains('current'));
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  };
  function closeToc() {
    if (!toc) return;
    clearTimeout(tocTimer);
    tocPinned = false;
    toc.classList.remove('open');
    toc.setAttribute('inert', '');
    toc.setAttribute('aria-hidden', 'true');
  }
  if (toc) {
    dotsWrap.addEventListener('mouseenter', () => {
      clearTimeout(tocTimer);
      tocTimer = setTimeout(openToc, 160);
    });
    dotsWrap.addEventListener('click', (e) => {
      // Only the bar itself toggles; the dots keep navigating.
      if (e.target !== dotsWrap) return;
      tocPinned = !tocOpen();
      tocPinned ? openToc() : closeToc();
    });
    const cluster = document.querySelector('.nav-cluster');
    cluster?.addEventListener('mouseleave', () => {
      clearTimeout(tocTimer);
      if (!tocPinned) tocTimer = setTimeout(closeToc, 260);
    });
    cluster?.addEventListener('mouseenter', () => clearTimeout(tocTimer));
    toc.querySelector('.toc-close')?.addEventListener('click', closeToc);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tocOpen()) closeToc(); });
    document.addEventListener('click', (e) => {
      if (tocOpen() && !document.querySelector('.nav-cluster')?.contains(e.target)) closeToc();
    });
  }
  let activeIndex = -1;
  let morphToken = 0;
  let carriedOrb = null;

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // Reset the Operating Model slide back to its clean, interactive DOM state and
  // remove any morph overlays/classes. Safe to call at any time.
  const cleanupOrbMorph = () => {
    const operatingSlide = slides.find((slide) => slide.dataset.title === 'Operating model');
    document.querySelectorAll('.morph-orb, .atom-lobe').forEach((el) => el.remove());
    carriedOrb = null;
    operatingSlide?.querySelectorAll('.model-orbit-wrap').forEach((wrap) => {
      wrap.getAnimations().forEach((a) => a.cancel());
      wrap.querySelectorAll('.orbit-core, .orbit-node').forEach((el) => {
        // Only cancel the WAAPI reveal animations we created via .animate() —
        // NOT the persistent CSS orbit-drift-a/b idle-motion animation, which
        // getAnimations() also returns. Blanket-cancelling every animation
        // here was stopping the drift animation mid-cycle (visible snap/
        // jitter as it reset to its 0% transform) and could leave it
        // cancelled for good, killing the subtle idle movement inside the
        // circles.
        el.getAnimations().forEach((a) => { if (!(a instanceof CSSAnimation)) a.cancel(); });
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
      });
      wrap.style.removeProperty('opacity');
      wrap.style.removeProperty('transform');
      wrap.style.removeProperty('transform-origin');
      wrap.style.removeProperty('transition');
    });
    document.body.classList.remove('orb-morphing');
  };

  const prepareOrbCarry = () => {
    if (prefersReducedMotion() || carriedOrb) return;
    const sourceCore = document.querySelector('.slide[data-title="Industries"] .core');
    const operatingSlide = slides.find((slide) => slide.dataset.title === 'Operating model');
    if (!sourceCore || !operatingSlide) return;
    const rect = sourceCore.getBoundingClientRect();
    const orb = document.createElement('div');
    orb.className = 'morph-orb';
    orb.innerHTML = sourceCore.innerHTML;
    Object.assign(orb.style, {
      left:`${rect.left}px`,
      top:`${rect.top}px`,
      width:`${rect.width}px`,
      height:`${rect.height}px`,
      transformOrigin:'center',
      opacity:'1',
    });
    document.body.appendChild(orb);
    carriedOrb = orb;
    document.body.classList.add('orb-morphing');
    operatingSlide.querySelectorAll('.model-orbit-wrap').forEach((target) => { target.style.opacity = '0'; });
  };

  // Wait until the deck has finished snapping to the target slide (or bail after
  // a timeout), so the split geometry is measured against settled positions.
  // Native CSS `scroll-snap-type` keeps adjusting scrollLeft in its own
  // browser-driven animation *after* wheel input stops and after a naive
  // "stopped moving for a few frames" poll can report false-stable (there are
  // brief gaps between wheel-event bursts during real trackpad/mouse
  // scrolling). The `scrollend` event is the only reliable signal that ALL
  // scrolling, including the native snap settle, has actually finished — so
  // prefer it, and only fall back to polling in browsers that lack it.
  const waitForScrollSettle = (targetSlide, timeout = 900) => new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      deck.removeEventListener('scrollend', onScrollEnd);
      resolve();
    };
    const onScrollEnd = () => finish();
    if ('onscrollend' in window) {
      deck.addEventListener('scrollend', onScrollEnd, { once: true });
      setTimeout(finish, timeout);
      return;
    }
    // Fallback: poll, but require a longer stable window since we can't
    // detect the native snap animation directly.
    const start = performance.now();
    let last = deck.scrollLeft;
    let stableFrames = 0;
    const tick = () => {
      const now = deck.scrollLeft;
      if (Math.abs(now - last) < 0.5) stableFrames += 1; else stableFrames = 0;
      last = now;
      if (stableFrames >= 10 || performance.now() - start > timeout) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Staged Industries -> Operating Model transition:
  //  1. Industry nodes/paths/glow fade, leaving the single S42 orb (via CSS).
  //  2. The orb is carried/held at the future center while the page settles.
  //  3. It splits like an atom: two glass shells separate left/right.
  //  4. The S42 logo + white core fade out during the split.
  //  5. Each shell forms its final circle progressively: outer glass, then the
  //     center label/icon, then the four internal role circles.
  const runOrbMorph = async () => {
    const token = ++morphToken;
    const cancelled = () => token !== morphToken;
    const operatingSlide = slides.find((slide) => slide.dataset.title === 'Operating model');
    const sourceCore = document.querySelector('.slide[data-title="Industries"] .core');
    const targets = operatingSlide ? Array.from(operatingSlide.querySelectorAll('.model-orbit-wrap')) : [];

    if (!operatingSlide || !sourceCore || targets.length !== 2 || prefersReducedMotion()) {
      cleanupOrbMorph();
      return;
    }

    const sourceRect = sourceCore.getBoundingClientRect();
    const orbSize = Math.max(sourceRect.width || 0, 132);

    // Position the carried orb at the center the two circles will settle into,
    // compensating for any horizontal scroll still in flight.
    const scrollDelta = operatingSlide.offsetLeft - deck.scrollLeft;
    const preRects = targets.map((t) => t.getBoundingClientRect());
    let centerX = (preRects[0].left + preRects[0].width / 2 + preRects[1].left + preRects[1].width / 2) / 2 - scrollDelta;
    let centerY = (preRects[0].top + preRects[0].height / 2 + preRects[1].top + preRects[1].height / 2) / 2;

    const orb = document.createElement('div');
    orb.className = 'morph-orb';
    orb.innerHTML = sourceCore.innerHTML;
    Object.assign(orb.style, {
      left: `${centerX - orbSize / 2}px`,
      top: `${centerY - orbSize / 2}px`,
      width: `${orbSize}px`,
      height: `${orbSize}px`,
      transformOrigin: 'center',
      opacity: '0',
    });
    document.body.appendChild(orb);

    try {
      // The orb fades in and is held while the page settles into place.
      orb.animate(
        [{ opacity: 0, transform: 'scale(.82)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
      );
      await waitForScrollSettle(operatingSlide);
      if (cancelled()) return;

      // Re-measure against settled positions and re-anchor the held orb.
      const rects = targets.map((t) => t.getBoundingClientRect());
      centerX = (rects[0].left + rects[0].width / 2 + rects[1].left + rects[1].width / 2) / 2;
      centerY = (rects[0].top + rects[0].height / 2 + rects[1].top + rects[1].height / 2) / 2;
      orb.style.left = `${centerX - orbSize / 2}px`;
      orb.style.top = `${centerY - orbSize / 2}px`;

      // Deliberate hold on the single centered orb before the split.
      await wait(460);
      if (cancelled()) return;

      // Prepare each target: reveal the wrap but keep its inner content hidden so
      // the glass shell forms first, then the label, then the role circles.
      targets.forEach((wrap) => {
        wrap.style.transformOrigin = 'center';
        wrap.style.opacity = '1';
        wrap.querySelectorAll('.orbit-core, .orbit-node').forEach((el) => { el.style.opacity = '0'; });
      });

      // Split: shells emerge from the common center and separate outward.
      const splitDuration = 1000;
      const splitAnimations = targets.map((wrap, index) => {
        const rect = rects[index];
        const dx = centerX - (rect.left + rect.width / 2);
        return wrap.animate([
          { transform: `translateX(${dx}px) scale(.4)`, opacity: 0 },
          { transform: `translateX(${dx * 0.62}px) scale(.56)`, opacity: 1, offset: 0.22 },
          { transform: 'translateX(0px) scale(1)', opacity: 1 },
        ], { duration: splitDuration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
      });

      // The S42 logo + white core fade away gradually as the shells split.
      orb.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.62)' }],
        { duration: 640, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
      );

      await Promise.allSettled(splitAnimations.map((a) => a.finished));
      if (cancelled()) return;
      orb.remove();

      // Center label/icon forms next.
      const coreReveals = targets.map((wrap) => {
        const core = wrap.querySelector('.orbit-core');
        return core.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 260, easing: 'ease-out', fill: 'forwards' },
        );
      });
      await Promise.allSettled(coreReveals.map((a) => a.finished));
      if (cancelled()) return;

      // Finally, the four internal role circles fade in, staggered.
      const nodeReveals = [];
      targets.forEach((wrap) => {
        wrap.querySelectorAll('.orbit-node').forEach((node, idx) => {
          nodeReveals.push(node.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            { duration: 220, delay: idx * 90, easing: 'ease-out', fill: 'forwards' },
          ));
        });
      });
      await Promise.allSettled(nodeReveals.map((a) => a.finished));
    } finally {
      if (token === morphToken) cleanupOrbMorph();
    }
  };

  // Continuous atom morph: two full final circles begin perfectly overlapped
  // beneath the S42 logo, then physically separate and grow into place while
  // their center content and role nodes form inside them.
  const runContinuousOrbMorph = async () => {
    const token = ++morphToken;
    const cancelled = () => token !== morphToken;
    const operatingSlide = slides.find((slide) => slide.dataset.title === 'Operating model');
    const sourceCore = document.querySelector('.slide[data-title="Industries"] .core');
    const targets = operatingSlide ? Array.from(operatingSlide.querySelectorAll('.model-orbit-wrap')) : [];
    if (!operatingSlide || !sourceCore || targets.length !== 2 || prefersReducedMotion()) {
      cleanupOrbMorph();
      return;
    }

    if (!carriedOrb) {
      const sourceRect = sourceCore.getBoundingClientRect();
      const orb = document.createElement('div');
      orb.className = 'morph-orb';
      orb.innerHTML = sourceCore.innerHTML;
      Object.assign(orb.style, {
        left:`${sourceRect.left}px`,
        top:`${sourceRect.top}px`,
        width:`${sourceRect.width}px`,
        height:`${sourceRect.height}px`,
        transformOrigin:'center',
        opacity:'1',
      });
      document.body.appendChild(orb);
      carriedOrb = orb;
    }

    try {
      // Wait for the deck to actually finish scrolling before measuring —
      // predicting the settled position analytically was off by tens of
      // pixels (offsetLeft doesn't always equal the true settle scrollLeft),
      // which caused a visible snap/jump once the real circles took over
      // from the lobes. Measuring the true settled rects removes that gap
      // entirely; the wait itself is short since native scroll-snap settles
      // quickly, and the logo/lobes only start animating once we know
      // exactly where they need to land.
      await waitForScrollSettle(operatingSlide, 500);
      if (cancelled()) return;

      const rects = targets.map((target) => target.getBoundingClientRect());
      const centerX = rects.reduce((sum, rect) => sum + rect.left + rect.width / 2, 0) / 2;
      const centerY = rects.reduce((sum, rect) => sum + rect.top + rect.height / 2, 0) / 2;
      const orbRect = carriedOrb.getBoundingClientRect();
      const carryX = centerX - (orbRect.left + orbRect.width / 2);
      const carryY = centerY - (orbRect.top + orbRect.height / 2);

      // The logo travels to the split center and fades away as a single
      // uninterrupted animation — no separate "carry" step, no re-snapping
      // to inline styles afterward, so there is no jump/jitter once it
      // arrives. The split (below) begins immediately in parallel instead
      // of waiting for the logo to finish moving first.
      carriedOrb.animate([
        { transform:'translate3d(0,0,0) scale(1)', opacity:1, offset:0 },
        { transform:`translate3d(${carryX}px,${carryY}px,0) scale(1.08)`, opacity:1, offset:.22 },
        { transform:`translate3d(${carryX}px,${carryY}px,0) scale(.78)`, opacity:0, offset:.55 },
        { transform:`translate3d(${carryX}px,${carryY}px,0) scale(.6)`, opacity:0, offset:1 },
      ], {
        duration:900,
        easing:'cubic-bezier(.4,0,.2,1)',
        fill:'forwards',
      });

      const originSize = orbRect.width * 1.08;
      const lobes = targets.map((target, index) => {
        const rect = rects[index];
        const lobe = document.createElement('div');
        lobe.className = 'atom-lobe';
        const circle = target.querySelector('.model-orbit').cloneNode(true);
        lobe.appendChild(circle);
        Object.assign(lobe.style, {
          left:`${rect.left}px`,
          top:`${rect.top}px`,
          width:`${rect.width}px`,
          height:`${rect.height}px`,
          transformOrigin:'center',
        });
        lobe.querySelectorAll('.orbit-core, .orbit-node').forEach((element) => { element.style.opacity = '0'; });
        document.body.appendChild(lobe);
        return lobe;
      });

      const lobeAnimations = lobes.map((lobe, index) => {
        const rect = rects[index];
        const dx = centerX - (rect.left + rect.width / 2);
        const dy = centerY - (rect.top + rect.height / 2);
        const scale = originSize / rect.width;
        const rotation = index === 0 ? -8 : 8;
        return lobe.animate([
          {
            transform:`translate3d(${dx}px,${dy}px,0) scale(${scale}) rotate(0deg)`,
            opacity:.58,
            offset:0,
          },
          {
            transform:`translate3d(${dx * .82}px,${dy * .82}px,0) scale(.42) rotate(${rotation * .2}deg)`,
            opacity:.76,
            offset:.22,
          },
          {
            transform:`translate3d(${dx * .52}px,${dy * .48}px,0) scale(.62) rotate(${rotation * .65}deg)`,
            opacity:.9,
            offset:.55,
          },
          { transform:`translate3d(${dx * .22}px,${dy * .18}px,0) scale(.82) rotate(${rotation * .35}deg)`, opacity:1, offset:.78 },
          { transform:'translate3d(0,0,0) scale(1) rotate(0deg)', opacity:1, offset:1 },
        ], {
          duration:1000,
          easing:'cubic-bezier(.4,0,.2,1)',
          fill:'forwards',
        });
      });

      const contentAnimations = [];
      lobes.forEach((lobe, lobeIndex) => {
        const core = lobe.querySelector('.orbit-core');
        contentAnimations.push(core.animate([
          { opacity:0, transform:'translate(-50%,-50%) scale(.55)' },
          { opacity:1, transform:'translate(-50%,-50%) scale(1)' },
        ], {
          duration:280,
          delay:430 + lobeIndex * 45,
          easing:'cubic-bezier(.16,1,.3,1)',
          fill:'forwards',
        }));
        lobe.querySelectorAll('.orbit-node').forEach((node, nodeIndex) => {
          contentAnimations.push(node.animate([
            { opacity:0, filter:'blur(6px)' },
            { opacity:1, filter:'blur(0)' },
          ], {
            duration:230,
            delay:560 + lobeIndex * 50 + nodeIndex * 45,
            easing:'ease-out',
            fill:'forwards',
          }));
        });
      });

      await Promise.allSettled([
        ...lobeAnimations.map((animation) => animation.finished),
        ...contentAnimations.map((animation) => animation.finished),
      ]);
      if (cancelled()) return;

      targets.forEach((target) => { target.style.opacity = '1'; });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    } finally {
      if (token === morphToken) cleanupOrbMorph();
    }
  };

  const setActive = (index) => {
    const previousSlide = slides[activeIndex];
    const activeSlide = slides[index];
    const shouldMorph = previousSlide?.dataset.title === 'Industries'
      && activeSlide?.dataset.title === 'Operating model'
      && !prefersReducedMotion();

    // Any navigation that isn't the Industries -> Operating morph must leave no
    // overlays, classes, or inline styles behind (incl. reverse navigation).
    if (!shouldMorph) {
      morphToken += 1;
      cleanupOrbMorph();
    } else {
      document.body.classList.add('orb-morphing');
      activeSlide.querySelectorAll('.model-orbit-wrap').forEach((target) => {
        target.style.opacity = '0';
        // Force the resting transform immediately so we measure the real
        // final position, not a frame still mid-way through the normal
        // "reveal" translateY/scale entrance transition.
        target.style.transition = 'none';
        target.style.transform = 'none';
      });
    }
    slides.forEach((s, i) => s.classList.toggle('in-view', i === index));
    dotEls.forEach((d, i) => d.classList.toggle('active', i === index));
    tocItems.forEach((b, i) => b.classList.toggle('current', i === index));
    syncPrompt(slides[index]);
    // Once the visitor has navigated past the cover slide, the arrow-key
    // nudge has done its job — dismiss it for good.
    if (index !== 0 && navNudge) navNudge.classList.remove('show');
    if (shouldMorph) requestAnimationFrame(() => runContinuousOrbMorph());
    activeIndex = index;
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
          setActive(slides.indexOf(entry.target));
        }
      });
    },
    { root: deck, threshold: [0.55] }
  );
  slides.forEach((s) => io.observe(s));

  // Convert vertical wheel input into horizontal scroll.
  deck.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const current = slides.find((slide) => slide.classList.contains('in-view'));
        if (e.deltaY > 0 && current?.dataset.title === 'Industries') prepareOrbCarry();
        e.preventDefault();
        deck.scrollLeft += e.deltaY;
      }
    },
    { passive: false }
  );

  document.addEventListener('keydown', (e) => {
    const current = slides.findIndex((s) => s.classList.contains('in-view'));
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      if (slides[current]?.dataset.title === 'Industries' && slides[current + 1]?.dataset.title === 'Operating model') prepareOrbCarry();
      slides[Math.min(current + 1, slides.length - 1)].scrollIntoView({ behavior: 'smooth', inline: 'start' });
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      slides[Math.max(current - 1, 0)].scrollIntoView({ behavior: 'smooth', inline: 'start' });
    }
  });

  // Scroll-linked parallax: elements with [data-depth] shift against the
  // slide's own travel distance, creating depth as slides pass by.
  const parallaxEls = Array.from(document.querySelectorAll('[data-depth]'));
  function parallaxTick() {
    const scrollLeft = deck.scrollLeft;
    parallaxEls.forEach((el) => {
      const slide = el.closest('.slide');
      const offset = slide ? slide.offsetLeft - scrollLeft : -scrollLeft;
      const depth = parseFloat(el.dataset.depth) || 0;
      el.style.setProperty('--px', `${offset * depth}px`);
    });
    requestAnimationFrame(parallaxTick);
  }
  requestAnimationFrame(parallaxTick);

  setActive(0);

  // No intro sequence: the cover is interactive from the first frame.
  if (navNudge) {
    navNudge.classList.add('show');
    // Auto-hide the nudge if the presenter lingers on the cover without moving.
    setTimeout(() => { if (activeIndex <= 0) navNudge.classList.remove('show'); }, 6000);
  }
})();

/* ---- What good looks like carousel ---- */
(function(){
  var root = document.querySelector('[data-carousel]');
  if (!root) return;
  var imgs  = Array.prototype.slice.call(root.querySelectorAll('.carousel-img'));
  var note  = root.querySelector('[data-car-note]');
  var dots  = root.querySelector('[data-car-dots]');
  var i = 0;

  imgs.forEach(function(_, n){
    var b = document.createElement('button');
    b.className = 'carousel-dot' + (n === 0 ? ' active' : '');
    b.setAttribute('aria-label', 'Example ' + (n + 1));
    b.addEventListener('click', function(){ go(n); });
    dots.appendChild(b);
  });

  function go(n){
    i = (n + imgs.length) % imgs.length;
    imgs.forEach(function(el, k){ el.classList.toggle('active', k === i); });
    Array.prototype.forEach.call(dots.children, function(el, k){
      el.classList.toggle('active', k === i);
    });
    note.textContent = imgs[i].dataset.note || '';
  }

  root.querySelector('[data-car-prev]').addEventListener('click', function(){ go(i - 1); });
  root.querySelector('[data-car-next]').addEventListener('click', function(){ go(i + 1); });
})();

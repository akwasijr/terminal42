/* Simple line-art pictograms (currentColor + one accent stop). */
window.S42_ICONS = (() => {
  const svg = (inner, vb = 32) =>
    `<svg viewBox="0 0 ${vb} ${vb}" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const S = 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"';

  return {
    energy: svg(`<path d="M18 3 L8 18h7l-2 11 11-16h-7z" ${S}/>`),
    health: svg(`<path d="M16 5v22M5 16h22" ${S}/><rect x="4" y="4" width="24" height="24" rx="6" ${S}/>`),
    manufacturing: svg(`<path d="M5 26V13l6 4V13l6 4V13l6 4v9z" ${S}/><path d="M5 26h22" ${S}/>`),
    telco: svg(`<circle cx="16" cy="22" r="1.6" fill="currentColor"/><path d="M10 18a8 8 0 0 1 12 0M6 14a13 13 0 0 1 20 0" ${S}/>`),
    security: svg(`<path d="M16 4l10 4v7c0 8-5 12-10 13-5-1-10-5-10-13V8z" ${S}/>`),
    gov: svg(`<path d="M16 4l12 7H4z" ${S}/><path d="M7 13v11M13 13v11M19 13v11M25 13v11" ${S}/><path d="M4 26h24" ${S}/>`),
    team: svg(`<circle cx="12" cy="11" r="4.2" ${S}/><circle cx="22" cy="13" r="3.4" ${S}/><path d="M4 27c0-5 4-8 8-8s8 3 8 8M18 27c.5-4 3-6.5 8-6.5" ${S}/>`),
    pod: svg(`<circle cx="16" cy="9" r="3.6" ${S}/><circle cx="7" cy="23" r="3.6" ${S}/><circle cx="25" cy="23" r="3.6" ${S}/><path d="M16 12.6V17M13 19l-4 2M19 19l4 2" ${S}/>`),
    insight: svg(`<circle cx="15" cy="14" r="9" ${S}/><path d="M27 27l-7-7" ${S}/>`),
    journey: svg(`<circle cx="6" cy="26" r="2.4" fill="currentColor"/><circle cx="26" cy="6" r="2.4" fill="currentColor"/><path d="M6 26C6 14 12 8 26 6" ${S}/>`),
    vision: svg(`<path d="M3 16s5-9 13-9 13 9 13 9-5 9-13 9-13-9-13-9z" ${S}/><circle cx="16" cy="16" r="4" ${S}/>`),
    story: svg(`<rect x="6" y="4" width="20" height="24" rx="2" ${S}/><path d="M11 11h10M11 16h10M11 21h6" ${S}/>`),
    proto: svg(`<rect x="4" y="7" width="24" height="16" rx="2" ${S}/><path d="M11 27h10M16 23v4" ${S}/>`),
    solution: svg(`<path d="M16 4v6M16 22v6M4 16h6M22 16h6" ${S}/><circle cx="16" cy="16" r="6" ${S}/>`),
    case: svg(`<rect x="4" y="11" width="24" height="15" rx="2" ${S}/><path d="M11 11V8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3" ${S}/>`),
    kickoff: svg(`<path d="M6 26L26 6M26 6h-8M26 6v8" ${S}/>`),
    explore: svg(`<circle cx="14" cy="14" r="9" ${S}/><path d="M26 26l-6.5-6.5" ${S}/>`),
    build: svg(`<path d="M8 24l12-12 4 4-12 12H8z" ${S}/><path d="M20 8l4 4" ${S}/>`),
    present: svg(`<rect x="3" y="6" width="26" height="16" rx="2" ${S}/><path d="M12 27h8M16 22v5" ${S}/>`),
    ip: svg(`<path d="M16 4l4 8 9 1-6.5 6.5L24 28l-8-4.5L8 28l1.5-8.5L3 13l9-1z" ${S}/>`),
    trust: svg(`<path d="M16 4l10 4v7c0 8-5 12-10 13-5-1-10-5-10-13V8z" ${S}/><path d="M12 16l3 3 6-6" ${S}/>`),
    visibility: svg(`<path d="M3 16s5-9 13-9 13 9 13 9-5 9-13 9-13-9-13-9z" ${S}/><circle cx="16" cy="16" r="3.4" fill="currentColor"/>`),
    hub: svg(`<circle cx="16" cy="16" r="5" ${S}/><path d="M16 4v6M16 22v6M4 16h6M22 16h6M7 7l4 4M25 7l-4 4M7 25l4-4M25 25l-4-4" ${S}/>`),
    accelerators: svg(`<path d="M16 3c5 4 7 9 7 14 0 3-1 6-3 8l-1-5-3 3-3-3-1 5c-2-2-3-5-3-8 0-5 2-10 7-14z" ${S}/><circle cx="16" cy="13" r="2.4" ${S}/>`),
    intel: svg(`<path d="M16 4l10 4v7c0 8-5 12-10 13-5-1-10-5-10-13V8z" ${S}/><circle cx="16" cy="15" r="4" ${S}/><circle cx="16" cy="15" r="1.2" fill="currentColor"/>`),
    rcg: svg(`<path d="M8 12h16l-1.5 14a2 2 0 0 1-2 1.8H11.5a2 2 0 0 1-2-1.8z" ${S}/><path d="M12 12V9a4 4 0 0 1 8 0v3" ${S}/>`),
    physical: svg(`<rect x="7" y="9" width="18" height="16" rx="3" ${S}/><circle cx="12.5" cy="16.5" r="1.6" fill="currentColor"/><circle cx="19.5" cy="16.5" r="1.6" fill="currentColor"/><path d="M12 21h8M16 4v5" ${S}/>`),
    fsi: svg(`<path d="M5 27V15M13 27V9M21 27V18M27 27V6" ${S}/><path d="M3 27h26" ${S}/>`),
    advisory: svg(`<circle cx="16" cy="13" r="9" ${S}/><path d="M12 28h8M16 22v6" ${S}/><path d="M16 8v5l3 3" ${S}/>`)
  };
})();

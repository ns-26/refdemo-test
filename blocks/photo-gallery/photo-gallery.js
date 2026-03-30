import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const STORAGE_KEY_PREFIX = 'photo-gallery-likes';

function createHeartSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('pg-heart');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z');
  svg.append(path);
  return svg;
}

function parseItems(originalRows) {
  return originalRows.map((row, index) => {
    const imgEl = row.querySelector('img');
    const titleEl = row.children[1]?.querySelector('h1, h2, h3, h4, h5, h6, p');
    const categoryEl = row.children[2]?.querySelector('p');
    const descEl = row.children[3];
    return {
      id: index,
      imgSrc: imgEl?.src || '',
      imgAlt: imgEl?.alt || '',
      title: titleEl?.textContent?.trim() || `Photo ${index + 1}`,
      category: categoryEl?.textContent?.trim() || 'Uncategorized',
      descClone: descEl ? descEl.cloneNode(true) : null,
      likes: 0,
      liked: false,
      el: null,
      rowEl: row,
    };
  });
}

function loadLikes(items, storageKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    items.forEach((item) => {
      const saved = stored[item.id];
      if (saved) {
        item.likes = saved.likes || 0;
        item.liked = saved.liked || false;
      }
    });
  } catch (e) {
    // ignore storage errors
  }
}

function persistLikes(items, storageKey) {
  try {
    const data = {};
    items.forEach((item) => {
      data[item.id] = { likes: item.likes, liked: item.liked };
    });
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    // ignore storage errors
  }
}

function applyFilters(state, ul) {
  const {
    items, activeCategory, searchQuery, sortOrder,
  } = state;
  const query = searchQuery.toLowerCase();
  const visible = [];

  items.forEach((item) => {
    const matchesCat = activeCategory === 'all' || item.category.toLowerCase() === activeCategory;
    const matchesSearch = !query
      || item.title.toLowerCase().includes(query)
      || item.category.toLowerCase().includes(query);
    const show = matchesCat && matchesSearch;
    item.el.hidden = !show;
    if (show) visible.push(item);
  });

  visible.sort((a, b) => {
    if (sortOrder === 'likes-desc') return b.likes - a.likes;
    if (sortOrder === 'likes-asc') return a.likes - b.likes;
    if (sortOrder === 'alpha') return a.title.localeCompare(b.title);
    return 0;
  });
  visible.forEach((item) => ul.append(item.el));
}

function buildCard(item, onLike, onOpen) {
  const li = document.createElement('li');
  li.className = 'pg-card';
  li.dataset.id = item.id;
  li.dataset.cat = item.category.toLowerCase();
  li.setAttribute('tabindex', '0');
  li.setAttribute('role', 'button');
  li.setAttribute('aria-label', `View ${item.title}`);
  moveInstrumentation(item.rowEl, li);

  const imgWrap = document.createElement('div');
  imgWrap.className = 'pg-card-img';
  if (item.imgSrc) {
    const pic = createOptimizedPicture(item.imgSrc, item.imgAlt, false, [{ width: '600' }]);
    const originalImg = item.rowEl.querySelector('img');
    if (originalImg) moveInstrumentation(originalImg, pic.querySelector('img'));
    imgWrap.append(pic);
  }

  const overlay = document.createElement('div');
  overlay.className = 'pg-card-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const meta = document.createElement('div');
  meta.className = 'pg-card-meta';

  const titleEl = document.createElement('h3');
  titleEl.className = 'pg-card-title';
  titleEl.textContent = item.title;

  const catEl = document.createElement('span');
  catEl.className = 'pg-card-cat';
  catEl.textContent = item.category;

  meta.append(titleEl, catEl);

  const likeBtn = document.createElement('button');
  likeBtn.className = 'pg-like-btn';
  likeBtn.setAttribute('aria-label', `Like ${item.title}`);
  likeBtn.setAttribute('aria-pressed', String(item.liked));
  likeBtn.type = 'button';
  likeBtn.append(createHeartSvg());

  const likeCount = document.createElement('span');
  likeCount.className = 'pg-like-count';
  likeCount.setAttribute('aria-live', 'polite');
  likeCount.textContent = item.likes;
  likeBtn.append(likeCount);

  likeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onLike(item.id);
  });

  overlay.append(meta, likeBtn);
  li.append(imgWrap, overlay);

  li.addEventListener('touchstart', () => li.classList.add('pg-card-touched'), { passive: true });
  li.addEventListener('touchend', () => {
    setTimeout(() => li.classList.remove('pg-card-touched'), 500);
  }, { passive: true });

  li.addEventListener('click', () => onOpen(item.id, li));
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(item.id, li);
    }
  });

  return li;
}

function buildLightbox(onLike) {
  const dialog = document.createElement('dialog');
  dialog.className = 'pg-lightbox';
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Photo detail');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'pg-lb-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.type = 'button';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => dialog.close());

  const content = document.createElement('div');
  content.className = 'pg-lb-content';

  const lbImg = document.createElement('div');
  lbImg.className = 'pg-lb-img';

  const info = document.createElement('div');
  info.className = 'pg-lb-info';

  const lbTitle = document.createElement('h2');
  lbTitle.className = 'pg-lb-title';

  const lbCat = document.createElement('span');
  lbCat.className = 'pg-lb-cat';

  const lbDesc = document.createElement('div');
  lbDesc.className = 'pg-lb-desc';

  const lbLikeBtn = document.createElement('button');
  lbLikeBtn.className = 'pg-lb-like';
  lbLikeBtn.setAttribute('aria-pressed', 'false');
  lbLikeBtn.setAttribute('aria-label', 'Like this photo');
  lbLikeBtn.type = 'button';
  lbLikeBtn.append(createHeartSvg());

  const lbLikeCount = document.createElement('span');
  lbLikeCount.className = 'pg-lb-like-count';
  lbLikeCount.setAttribute('aria-live', 'polite');
  lbLikeCount.textContent = '0';
  lbLikeBtn.append(lbLikeCount);
  lbLikeBtn.addEventListener('click', onLike);

  const tipsBtn = document.createElement('button');
  tipsBtn.className = 'pg-lb-tips';
  tipsBtn.type = 'button';
  tipsBtn.textContent = 'Ask for tips';
  tipsBtn.addEventListener('click', () => {
    dialog.dispatchEvent(new CustomEvent('photo-gallery:tips-requested', {
      bubbles: true,
      detail: { title: lbTitle.textContent, category: lbCat.textContent },
    }));
  });

  info.append(lbTitle, lbCat, lbDesc, lbLikeBtn, tipsBtn);
  content.append(lbImg, info);
  dialog.append(closeBtn, content);

  dialog.addEventListener('click', (e) => {
    const rect = content.getBoundingClientRect();
    const outside = e.clientX < rect.left
      || e.clientX > rect.right
      || e.clientY < rect.top
      || e.clientY > rect.bottom;
    if (outside) dialog.close();
  });

  return dialog;
}

function buildToolbar(categories, state, onSort, onFilter, onSearch) {
  const toolbar = document.createElement('div');
  toolbar.className = 'pg-toolbar';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'pg-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search photos\u2026';
  searchInput.setAttribute('aria-label', 'Search photos');
  searchInput.addEventListener('input', () => onSearch(searchInput.value));
  searchWrap.append(searchInput);

  const pillsWrap = document.createElement('div');
  pillsWrap.className = 'pg-categories';

  ['all', ...categories].forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'pg-pill';
    btn.type = 'button';
    btn.dataset.cat = cat;
    btn.textContent = cat === 'all' ? 'All' : cat;
    btn.setAttribute('aria-pressed', String(state.activeCategory === cat));
    if (state.activeCategory === cat) btn.classList.add('active');
    btn.addEventListener('click', () => {
      pillsWrap.querySelectorAll('.pg-pill').forEach((p) => {
        p.classList.toggle('active', p.dataset.cat === cat);
        p.setAttribute('aria-pressed', String(p.dataset.cat === cat));
      });
      onFilter(cat);
    });
    pillsWrap.append(btn);
  });

  const sortWrap = document.createElement('div');
  sortWrap.className = 'pg-sort';
  const sortSelect = document.createElement('select');
  sortSelect.setAttribute('aria-label', 'Sort by');
  [
    { value: 'likes-desc', label: 'Most liked' },
    { value: 'likes-asc', label: 'Least liked' },
    { value: 'alpha', label: 'A \u2013 Z' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    sortSelect.append(opt);
  });
  sortSelect.value = state.sortOrder;
  sortSelect.addEventListener('change', () => onSort(sortSelect.value));
  sortWrap.append(sortSelect);

  const likedCount = document.createElement('span');
  likedCount.className = 'pg-liked-count';
  const n = state.items.filter((i) => i.liked).length;
  likedCount.textContent = `${n} liked`;

  toolbar.append(searchWrap, pillsWrap, sortWrap, likedCount);
  return toolbar;
}

export default function decorate(block) {
  const originalRows = [...block.children];

  const state = {
    items: parseItems(originalRows),
    activeCategory: 'all',
    searchQuery: '',
    sortOrder: 'likes-desc',
    lightboxIndex: -1,
    lastFocusedCard: null,
  };

  const blockIndex = [...document.querySelectorAll('.photo-gallery')].indexOf(block);
  const storageKey = `${STORAGE_KEY_PREFIX}-${blockIndex}`;
  loadLikes(state.items, storageKey);

  const categories = [...new Set(state.items.map((i) => i.category))].sort();
  const ul = document.createElement('ul');
  ul.className = 'pg-grid';

  // Assigned below; closures reference safely — event handlers only fire
  // after full DOM construction, by which point both are initialized.
  let toolbar;
  let dialog;

  const updateLikeUI = (id) => {
    const item = state.items[id];
    const cardBtn = item.el?.querySelector('.pg-like-btn');
    if (cardBtn) {
      cardBtn.setAttribute('aria-pressed', String(item.liked));
      cardBtn.querySelector('.pg-like-count').textContent = item.likes;
    }
    if (state.lightboxIndex === id) {
      const lbBtn = dialog.querySelector('.pg-lb-like');
      lbBtn.setAttribute('aria-pressed', String(item.liked));
      lbBtn.querySelector('.pg-lb-like-count').textContent = item.likes;
    }
    const likedN = state.items.filter((i) => i.liked).length;
    toolbar.querySelector('.pg-liked-count').textContent = `${likedN} liked`;
  };

  const onLikeCard = (id) => {
    const item = state.items[id];
    item.liked = !item.liked;
    item.likes = item.liked ? item.likes + 1 : Math.max(0, item.likes - 1);
    persistLikes(state.items, storageKey);
    updateLikeUI(id);
  };

  const onLikeLightbox = () => {
    if (state.lightboxIndex >= 0) onLikeCard(state.lightboxIndex);
  };

  const onOpenLightbox = (id, cardEl) => {
    const item = state.items[id];
    state.lightboxIndex = id;
    state.lastFocusedCard = cardEl;

    const lbImg = dialog.querySelector('.pg-lb-img');
    lbImg.textContent = '';
    if (item.imgSrc) {
      lbImg.append(createOptimizedPicture(item.imgSrc, item.imgAlt, false, [
        { media: '(min-width: 600px)', width: '1200' },
        { width: '800' },
      ]));
    }

    dialog.querySelector('.pg-lb-title').textContent = item.title;
    dialog.querySelector('.pg-lb-cat').textContent = item.category;
    const lbDesc = dialog.querySelector('.pg-lb-desc');
    lbDesc.textContent = '';
    if (item.descClone) lbDesc.append(item.descClone.cloneNode(true));

    const lbBtn = dialog.querySelector('.pg-lb-like');
    lbBtn.setAttribute('aria-pressed', String(item.liked));
    lbBtn.querySelector('.pg-lb-like-count').textContent = item.likes;

    dialog.showModal();
    dialog.querySelector('.pg-lb-close').focus();
  };

  dialog = buildLightbox(onLikeLightbox);
  dialog.addEventListener('close', () => {
    state.lightboxIndex = -1;
    if (state.lastFocusedCard) {
      state.lastFocusedCard.focus();
      state.lastFocusedCard = null;
    }
  });

  toolbar = buildToolbar(
    categories,
    state,
    (sortOrder) => { state.sortOrder = sortOrder; applyFilters(state, ul); },
    (cat) => { state.activeCategory = cat; applyFilters(state, ul); },
    (query) => { state.searchQuery = query; applyFilters(state, ul); },
  );

  state.items.forEach((item) => {
    const li = buildCard(item, onLikeCard, onOpenLightbox);
    item.el = li;
    ul.append(li);
  });

  block.textContent = '';
  block.append(toolbar, ul, dialog);
  applyFilters(state, ul);
}

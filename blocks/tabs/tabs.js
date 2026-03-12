export default async function decorate(block) {
  const tabsStyleParagraph = block.querySelector('p[data-aue-prop="tabsstyle"]');
  const tabsStyle = tabsStyleParagraph?.textContent?.trim() || '';

  if (tabsStyle && tabsStyle !== 'default' && tabsStyle !== '') {
    block.classList.add(tabsStyle);
  }

  if (!block.classList.contains('card-style-tab')) {
    const knownStyles = new Set(['card-style-tab']);
    const styleContainerFallback = [...block.children].find((child) => (
      [...child.querySelectorAll('p')].some((p) => knownStyles.has(p.textContent?.trim()))
    ));
    if (styleContainerFallback) {
      const detected = [...styleContainerFallback.querySelectorAll('p')]
        .map((p) => p.textContent?.trim())
        .find((txt) => knownStyles.has(txt));
      if (detected) {
        block.classList.add(detected);
        styleContainerFallback.remove();
      }
    }
  }

  const styleNodes = block.querySelectorAll('p[data-aue-prop="tabsstyle"]');
  styleNodes.forEach((node) => {
    let container = node;
    while (container && container.parentElement !== block) {
      container = container.parentElement;
    }
    if (container && container.parentElement === block) {
      container.remove();
    } else {
      node.remove();
    }
  });

  [...block.children]
    .filter((child) => child.matches && child.matches('p[data-aue-prop="title"]'))
    .forEach((titleNode) => titleNode.remove());

  const tabItems = [];
  [...block.children].forEach((row) => {
    if (!row || !row.firstElementChild) return;
    if (row.querySelector && row.querySelector('p[data-aue-prop="tabsstyle"]')) return;
    const titleCol = row.querySelector(':scope > div:nth-child(1)');
    const explicitTitle = row.querySelector('p[data-aue-prop="title"]');
    const labelText = (explicitTitle?.textContent || titleCol?.textContent || '').trim();
    if (!labelText) return;
    tabItems.push({ row, labelText });
  });

  const nav = document.createElement('div');
  nav.className = 'tabs-nav';
  nav.setAttribute('role', 'tablist');

  tabItems.forEach((item, i) => {
    const { row, labelText } = item;
    row.classList.add('tabs-item');
    if (i === 0) row.classList.add('active');

    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.textContent = labelText;
    button.setAttribute('aria-selected', i === 0);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');

    button.addEventListener('click', () => {
      block.querySelectorAll('.tabs-item').forEach((el) => el.classList.remove('active'));
      nav.querySelectorAll('.tabs-tab').forEach((btn) => btn.setAttribute('aria-selected', false));
      row.classList.add('active');
      button.setAttribute('aria-selected', true);
    });

    nav.appendChild(button);
  });

  block.prepend(nav);
}

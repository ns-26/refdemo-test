import { moveInstrumentation } from '../../scripts/scripts.js';

// keep track globally of the number of tab blocks on the page
let tabBlockCnt = 0;

export default async function decorate(block) {
  // Get the tabs style from data-aue-prop
  const tabsStyleParagraph = block.querySelector('p[data-aue-prop="tabsstyle"]');
  const tabsStyle = tabsStyleParagraph?.textContent?.trim() || '';

  // Add the style class to block
  if (tabsStyle && tabsStyle !== 'default' && tabsStyle !== '') {
    block.classList.add(tabsStyle);
  }

  // Fallback for Live where style may be a plain <p> row like "card-style-tab"
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

  // Proactively remove any style-config node so it doesn't become a tab (UE/Live)
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

  // Remove any stray top-level title nodes that UE may render under Tabs root
  [...block.children]
    .filter((child) => child.matches && child.matches('p[data-aue-prop="title"]'))
    .forEach((titleNode) => titleNode.remove());

  const cardStyleVariant = block.classList.contains('card-style-tab');

  // Build tab items from authored rows, skipping children without a valid title
  const tabItems = [];
  [...block.children].forEach((child) => {
    if (!child || !child.firstElementChild) return;
    if (child.querySelector && child.querySelector('p[data-aue-prop="tabsstyle"]')) return;
    const heading = child.firstElementChild;
    const explicitTitle = child.querySelector && child.querySelector('p[data-aue-prop="title"]');
    const labelText = (explicitTitle?.textContent || heading?.textContent || '').trim();
    if (!labelText) return;
    tabItems.push({ tabpanel: child, heading });
  });

  tabBlockCnt += 1;

  // Outer ul wrapper (mirrors accordion structure)
  const outerUl = document.createElement('ul');

  // Tablist as li (first list item holds all tab buttons)
  const tablist = document.createElement('li');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');
  tablist.id = `tablist-${tabBlockCnt}`;

  tabItems.forEach((item, i) => {
    const id = `tabpanel-${tabBlockCnt}-tab-${i + 1}`;
    const { tabpanel: row, heading: tab } = item;

    const titleEl = row.querySelector('p[data-aue-prop="title"]');
    const headingContent = (titleEl ? titleEl.innerHTML : tab.innerHTML);

    // Each tab panel becomes an li (mirrors accordion-item)
    const panelLi = document.createElement('li');
    panelLi.className = 'tabs-panel';
    panelLi.id = id;
    panelLi.setAttribute('aria-hidden', !!i);
    panelLi.setAttribute('aria-labelledby', `tab-${id}`);
    panelLi.setAttribute('role', 'tabpanel');
    moveInstrumentation(row, panelLi);

    if (cardStyleVariant) {
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'tabs-panel-content';

      const picture = row.querySelector('picture');
      let imageWrapper = null;
      if (picture) {
        imageWrapper = document.createElement('div');
        imageWrapper.className = 'tabs-panel-image';
        const pictureParent = picture.parentElement;
        const pictureElement = (pictureParent && pictureParent.tagName === 'P') ? pictureParent : picture;
        imageWrapper.appendChild(pictureElement);
      }

      const children = Array.from(row.children);
      children.forEach((child) => {
        if (child !== tab && child !== imageWrapper && child !== titleEl) {
          contentWrapper.appendChild(child);
        }
      });

      if (imageWrapper) {
        panelLi.appendChild(imageWrapper);
      } else {
        panelLi.classList.add('no-image');
      }
      panelLi.appendChild(contentWrapper);
    } else {
      if (tab && tab.parentElement === row) tab.remove();
      if (titleEl) titleEl.style.display = 'none';

      // Convert remaining child divs to inner ul > li
      const innerUl = document.createElement('ul');
      [...row.children].forEach((child) => {
        const li = document.createElement('li');
        while (child.firstChild) li.appendChild(child.firstChild);
        innerUl.appendChild(li);
      });
      panelLi.appendChild(innerUl);
    }

    // Build tab button
    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;
    button.innerHTML = headingContent;
    button.setAttribute('aria-controls', id);
    button.setAttribute('aria-selected', !i);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');

    button.addEventListener('click', () => {
      outerUl.querySelectorAll('[role=tabpanel]').forEach((panel) => {
        panel.setAttribute('aria-hidden', true);
      });
      tablist.querySelectorAll('button').forEach((btn) => {
        btn.setAttribute('aria-selected', false);
      });
      panelLi.setAttribute('aria-hidden', false);
      button.setAttribute('aria-selected', true);
    });

    if (button.firstElementChild) {
      moveInstrumentation(button.firstElementChild, null);
    }

    tablist.append(button);
    outerUl.append(panelLi);
  });

  outerUl.prepend(tablist);
  block.textContent = '';
  block.append(outerUl);
}

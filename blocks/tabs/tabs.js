import { moveInstrumentation } from '../../scripts/scripts.js';

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

  const cardStyleVariant = block.classList.contains('card-style-tab');

  const tabItems = [];
  [...block.children].forEach((child) => {
    if (!child || !child.firstElementChild) return;
    if (child.querySelector && child.querySelector('p[data-aue-prop="tabsstyle"]')) return;
    const heading = child.firstElementChild;
    const explicitTitle = child.querySelector && child.querySelector('p[data-aue-prop="title"]');
    const labelText = (explicitTitle?.textContent || heading?.textContent || '').trim();
    if (!labelText) return;
    tabItems.push({ row: child, heading });
  });

  const outerUl = document.createElement('ul');

  tabItems.forEach((item, i) => {
    const { row, heading: tab } = item;
    const titleEl = row.querySelector('p[data-aue-prop="title"]');
    const headingContent = (titleEl ? titleEl.innerHTML : tab.innerHTML);

    const li = document.createElement('li');
    li.className = 'tabs-item';
    if (i === 0) li.classList.add('active');
    moveInstrumentation(row, li);

    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.innerHTML = headingContent;
    button.setAttribute('aria-selected', !i);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');

    if (button.firstElementChild) {
      moveInstrumentation(button.firstElementChild, null);
    }

    button.addEventListener('click', () => {
      outerUl.querySelectorAll('.tabs-item').forEach((el) => el.classList.remove('active'));
      outerUl.querySelectorAll('.tabs-tab').forEach((btn) => btn.setAttribute('aria-selected', false));
      li.classList.add('active');
      button.setAttribute('aria-selected', true);
    });

    li.appendChild(button);

    // Remove the title cell from the authored row
    if (tab && tab.parentElement === row) tab.remove();
    if (titleEl && row.contains(titleEl)) titleEl.style.display = 'none';

    if (cardStyleVariant) {
      const panelDiv = document.createElement('div');
      panelDiv.className = 'tabs-panel';

      const picture = row.querySelector('picture');
      if (picture) {
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'tabs-panel-image';
        const pictureParent = picture.parentElement;
        const pictureElement = (pictureParent && pictureParent.tagName === 'P') ? pictureParent : picture;
        imageWrapper.appendChild(pictureElement);
        panelDiv.appendChild(imageWrapper);
      } else {
        panelDiv.classList.add('no-image');
      }

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'tabs-panel-content';
      while (row.firstElementChild) {
        const child = row.firstElementChild;
        if (child.tagName === 'DIV') {
          while (child.firstChild) contentWrapper.appendChild(child.firstChild);
          child.remove();
        } else {
          contentWrapper.appendChild(child);
        }
      }
      panelDiv.appendChild(contentWrapper);
      li.appendChild(panelDiv);
    } else {
      // Unwrap cell divs — move their children flat into the li
      while (row.firstElementChild) {
        const child = row.firstElementChild;
        if (child.tagName === 'DIV') {
          while (child.firstChild) li.appendChild(child.firstChild);
          child.remove();
        } else {
          li.appendChild(child);
        }
      }
    }

    outerUl.appendChild(li);
  });

  block.textContent = '';
  block.append(outerUl);
}

/*
 * Accordion Block
 * Recreate an accordion
 * https://www.hlx.live/developer/block-collection/accordion
 */

export default function decorate(block) {
  [...block.children].forEach((row) => {
    // decorate accordion item label
    const label = row.children[0];
    const title = document.createElement('div');
    title.className = 'accordion-item-label';
    title.append(...label.childNodes);
    // decorate accordion item body
    const body = row.children[1];
    body.className = 'accordion-item-body';
    // decorate accordion item
    const accordionItem = document.createElement('div');
    accordionItem.className = 'accordion-item';
    accordionItem.append(title, body);
    row.replaceWith(accordionItem);
  });
}

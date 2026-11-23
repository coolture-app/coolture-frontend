/**
 * A phone's keyboard covers the page without resizing it, so whatever sits at the bottom of the screen moves up by
 * `--keyboard-inset`, which this keeps on the root.
 */
export function trackKeyboardInset(document: Document): void {
  const view = document.defaultView;
  const viewport = view?.visualViewport;
  if (!view || !viewport) {
    return;
  }
  const update = () => {
    const covered = view.innerHeight - viewport.height - viewport.offsetTop;
    document.documentElement.style.setProperty(
      '--keyboard-inset',
      `${Math.max(0, Math.round(covered))}px`,
    );
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
}

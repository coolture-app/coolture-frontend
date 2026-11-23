/** Polls instead of sleeping, for what a spec can't reach by a signal or a promise (a popstate, a frame). */
export async function until(done: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (done()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

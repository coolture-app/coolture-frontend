import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let confirm: ConfirmService;
  const question = { title: 'T', confirm: 'C' };

  beforeEach(() => {
    confirm = TestBed.inject(ConfirmService);
  });

  it('answers yes only to the confirm button', async () => {
    const yes = confirm.ask(question);
    confirm.answer('confirm');
    const no = confirm.ask(question);
    confirm.answer('other');

    expect(await yes).toBeTrue();
    expect(await no).toBeFalse();
    expect(confirm.request()).toBeNull();
  });

  it('cancels the open question when a new one comes', async () => {
    const first = confirm.choose(question);
    const second = confirm.choose({ ...question, title: 'U' });

    expect(await first).toBe('cancel');
    expect(confirm.request()?.title).toBe('U');
    confirm.answer('confirm');
    expect(await second).toBe('confirm');
  });
});

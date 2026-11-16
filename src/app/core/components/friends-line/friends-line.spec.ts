import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FriendsLine } from './friends-line';
import { FriendStances } from '../../models/posts/friend-stances.model';

describe('FriendsLine', () => {
  let fixture: ComponentFixture<FriendsLine>;

  function render(stances: FriendStances | undefined): HTMLButtonElement | null {
    fixture.componentRef.setInput('stances', stances);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.friends');
  }

  /** Each group's stance, then its parts in order: the icon, the faces, the names. */
  function groups(line: HTMLElement): string[][] {
    return Array.from(line.querySelectorAll('.friends__group')).map((group) => [
      group.classList.contains('friends__group--going') ? 'going' : 'interested',
      ...Array.from(
        group.querySelectorAll('.friends__icon, .friends__face, .friends__names'),
        (part) =>
          part.classList.contains('friends__icon')
            ? 'icon'
            : part.classList.contains('friends__face')
              ? `face:${part.getAttribute('src') ?? part.textContent?.trim()}`
              : part.textContent!.trim(),
      ),
    ]);
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(FriendsLine);
  });

  it('shows going first, then interested, each with its icon, its own faces and names', () => {
    const line = render({
      interested: {
        count: 2,
        people: [
          { id: 'o', username: 'ola', firstName: 'Ola', avatarUrl: '/ola.jpg' },
          { id: 'a', username: 'anna_demo', firstName: 'Anna' },
        ],
      },
      going: { count: 1, people: [{ id: 'c', username: 'coolture' }] },
    })!;

    expect(groups(line)).toEqual([
      ['going', 'icon', 'face:C', 'coolture'],
      ['interested', 'icon', 'face:/ola.jpg', 'face:A', 'Ola, Anna'],
    ]);
    expect(line.querySelectorAll('.friends__dot').length).toBe(1);
  });

  it('counts the rest of a stance as +N', () => {
    const line = render({
      going: {
        count: 5,
        people: [
          { id: 'a', username: 'anna_demo', firstName: 'Anna' },
          { id: 'j', username: 'jan_demo' },
        ],
      },
    })!;

    expect(groups(line)).toEqual([['going', 'icon', 'face:A', 'face:J', 'Anna, jan_demo +3']]);
    expect(line.querySelector('.friends__dot')).toBeNull();
  });

  it('is a button that says it all and opens the list, with no tooltip', () => {
    let opened = 0;
    fixture.componentInstance.opened.subscribe(() => opened++);
    const line = render({
      going: { count: 1, people: [{ id: 'c', username: 'coolture' }] },
      interested: { count: 1, people: [{ id: 'o', username: 'ola', firstName: 'Ola' }] },
    })!;

    expect(line.tagName).toBe('BUTTON');
    expect(line.getAttribute('aria-label')).toBe('POST.friendsGoing · POST.friendsInterested');
    expect(line.hasAttribute('apptooltip')).toBeFalse();
    line.click();
    expect(opened).toBe(1);
  });

  it('shows nothing without friends', () => {
    expect(render(undefined)).toBeNull();
  });
});

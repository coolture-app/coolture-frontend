import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { BackLink } from './back-link';
import { BackService, BackTarget } from '../../services/back/back.service';

describe('BackLink', () => {
  let target: BackTarget;
  let back: jasmine.Spy;

  const render = () => {
    const fixture = TestBed.createComponent(BackLink);
    fixture.componentRef.setInput('fallback', '/people');
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
  };

  beforeEach(() => {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('pl', {
      BACK: { to: 'Wróć do: {{page}}' },
      NAVBAR: { people: 'Ludzie' },
    });
    translate.use('pl');
    const service = TestBed.inject(BackService);
    target = { url: '/users/jan_demo', label: { text: '@jan_demo' } };
    spyOn(service, 'target').and.callFake(() => target);
    back = spyOn(service, 'back');
  });

  it('names the page it goes back to, and links to it', () => {
    const link = render();

    expect(link.textContent?.trim()).toBe('@jan_demo');
    expect(link.getAttribute('aria-label')).toBe('Wróć do: @jan_demo');
    expect(link.getAttribute('href')).toBe('/users/jan_demo');
  });

  it('translates a page named by a key', () => {
    target = { url: '/people', label: { key: 'NAVBAR.people' } };

    expect(render().textContent?.trim()).toBe('Ludzie');
  });

  it('goes back with its fallback on a click', () => {
    const link = render();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });

    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBeTrue();
    expect(back).toHaveBeenCalledOnceWith('/people');
  });

  it('leaves a click that opens a new tab to the browser', () => {
    const link = render();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link.addEventListener('click', (event) => event.preventDefault());

    link.dispatchEvent(click);

    expect(back).not.toHaveBeenCalled();
  });
});

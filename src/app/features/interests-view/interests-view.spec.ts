import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { InterestCatalog, UserInterests } from '../../core/models/interests/interest.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { InterestsService } from '../../core/services/interests/interests.service';
import { InterestsView } from './interests-view';

const named = (key: string) => ({ key, labelPl: key, labelEn: key });

const CATALOG: InterestCatalog = {
  minKinds: 1,
  minInterests: 0,
  maxInterests: 3,
  kinds: ['concerts', 'stage', 'kids'].map(named),
  categories: [
    {
      key: 'music',
      labelPl: 'Muzyka',
      labelEn: 'Music',
      interests: ['jazz', 'rock', 'opera', 'pop'].map(named),
    },
  ],
};

describe('InterestsView', () => {
  let fixture: ComponentFixture<InterestsView>;
  let element: HTMLElement;
  const authService = {
    userId: () => 'user-1',
    markInterestsSelected: jasmine.createSpy('markInterestsSelected'),
  };
  const interestsService = jasmine.createSpyObj<InterestsService>('InterestsService', [
    'getCatalog',
    'getUserInterests',
    'replaceUserInterests',
  ]);

  const kind = (name: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('.kind')].find(
      (button) => button.querySelector('.kind__name')?.textContent?.trim() === name,
    )!;
  const topic = (text: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('.interests__tiles button')].find(
      (button) => button.textContent?.trim() === text,
    )!;
  const footerButton = (text: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('.interests__footer button')].find(
      (button) => button.textContent?.trim() === text,
    )!;
  const save = () => footerButton('INTERESTS.save');
  const modalButton = (index: number) =>
    element.querySelectorAll<HTMLButtonElement>('app-modal-window button')[index];
  const error = () => element.querySelector('.interests__error');

  async function render(
    saved: Partial<UserInterests> = {},
    onboarding = false,
    catalog: Observable<InterestCatalog> = of(CATALOG),
  ) {
    interestsService.getCatalog.and.returnValue(catalog);
    interestsService.getUserInterests.and.returnValue(
      of({ kinds: saved.kinds ?? [], interests: saved.interests ?? [] }),
    );
    interestsService.replaceUserInterests.and.callFake((_id, selection) => of(selection));
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [InterestsView, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: InterestsService, useValue: interestsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestsView);
    fixture.componentRef.setInput('onboarding', onboarding);
    element = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(button: HTMLElement) {
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    interestsService.replaceUserInterests.calls.reset();
    authService.markInterestsSelected.calls.reset();
  });

  describe('onboarding', () => {
    it('asks for the kinds first, without the topics', async () => {
      await render({}, true);

      expect(kind('concerts')).toBeDefined();
      expect(topic('jazz')).toBeUndefined();
      expect(footerButton('INTERESTS.next').disabled).toBeTrue();
    });

    it('goes on to the topics once a kind is picked, and back with the picks kept', async () => {
      await render({}, true);
      await click(kind('stage'));

      await click(footerButton('INTERESTS.next'));
      expect(kind('stage')).toBeUndefined();
      expect(topic('jazz')).toBeDefined();

      await click(footerButton('INTERESTS.back'));
      expect(kind('stage').getAttribute('aria-pressed')).toBe('true');
    });

    it('saves the kinds alone when the topics are skipped', async () => {
      await render({}, true);
      await click(kind('concerts'));
      await click(footerButton('INTERESTS.next'));

      await click(footerButton('INTERESTS.skip-topics'));

      expect(interestsService.replaceUserInterests).toHaveBeenCalledOnceWith('user-1', {
        kinds: ['concerts'],
        interests: [],
      });
    });

    it('ticks the topics an account held before kinds', async () => {
      await render({ interests: ['jazz'] }, true);
      await click(kind('concerts'));
      await click(footerButton('INTERESTS.next'));

      expect(interestsService.getUserInterests).toHaveBeenCalledWith('user-1');
      expect(topic('jazz').getAttribute('aria-pressed')).toBe('true');
      expect(save()).toBeDefined();
    });

    it('goes on to the next step instead of leaving the page', async () => {
      await render({}, true);
      const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      const saved = jasmine.createSpy('saved');
      fixture.componentInstance.saved.subscribe(saved);
      await click(kind('concerts'));
      await click(footerButton('INTERESTS.next'));
      await click(topic('jazz'));

      await click(save());

      expect(saved).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('can be skipped when the catalogue is down', async () => {
      await render(
        {},
        true,
        throwError(() => new Error('down')),
      );
      const dismissed = jasmine.createSpy('dismissed');
      fixture.componentInstance.dismissed.subscribe(dismissed);

      await click(footerButton('INTERESTS.skip'));

      expect(dismissed).toHaveBeenCalledTimes(1);
    });

    it('has no link back to the profile', async () => {
      await render({}, true);

      expect(element.querySelector('app-back-link')).toBeNull();
    });
  });

  describe('editing', () => {
    it('shows the kinds and the topics on one page, with one save', async () => {
      await render({ kinds: ['concerts'], interests: ['jazz'] });

      expect(kind('concerts').getAttribute('aria-pressed')).toBe('true');
      expect(topic('jazz').getAttribute('aria-pressed')).toBe('true');
      expect(footerButton('INTERESTS.next')).toBeUndefined();
      expect(save().disabled).toBeFalse();
    });

    it('links back to the profile', async () => {
      await render({ kinds: ['concerts'] });

      expect(element.querySelector('app-back-link a')?.getAttribute('href')).toBe('/profile');
    });

    it("can't save without a kind", async () => {
      await render({ kinds: ['concerts'] });

      await click(kind('concerts'));

      expect(save().disabled).toBeTrue();
    });

    it('blocks more topics at the limit', async () => {
      await render({ kinds: ['concerts'] });

      await click(topic('jazz'));
      await click(topic('rock'));
      await click(topic('opera'));

      expect(topic('pop').disabled).toBeTrue();
      expect(topic('jazz').disabled).toBeFalse();
    });

    it('drops a held topic that is no longer offered, without counting it', async () => {
      await render({ kinds: ['concerts'], interests: ['astrology', 'jazz'] });
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      expect(fixture.componentInstance.confirmLeave()).toBeTrue();

      await click(topic('rock'));
      await click(topic('opera'));
      expect(topic('pop').disabled).toBeTrue();

      await click(save());
      expect(interestsService.replaceUserInterests).toHaveBeenCalledOnceWith('user-1', {
        kinds: ['concerts'],
        interests: jasmine.arrayWithExactContents(['jazz', 'rock', 'opera']),
      });
    });

    it('sends the picked kinds and topics, and goes back to the profile', async () => {
      await render({ kinds: ['concerts'] });
      const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      await click(kind('stage'));
      await click(topic('jazz'));

      await click(save());

      expect(interestsService.replaceUserInterests).toHaveBeenCalledOnceWith('user-1', {
        kinds: jasmine.arrayWithExactContents(['concerts', 'stage']),
        interests: ['jazz'],
      });
      expect(navigate).toHaveBeenCalledOnceWith('/profile');
    });

    it('marks the selection as made after saving', async () => {
      await render({ kinds: ['concerts'] });
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      await click(topic('rock'));

      await click(save());

      expect(authService.markInterestsSelected).toHaveBeenCalledWith({
        kinds: ['concerts'],
        interests: ['rock'],
      });
      expect(fixture.componentInstance.confirmLeave()).toBeTrue();
    });

    it('sends one request when save is clicked twice at once', async () => {
      await render({ kinds: ['concerts'] });
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      save().click();
      await click(save());

      expect(interestsService.replaceUserInterests).toHaveBeenCalledTimes(1);
    });

    it('locks the picks while saving', async () => {
      await render({ kinds: ['concerts'] });
      const pending = new Subject<UserInterests>();
      interestsService.replaceUserInterests.and.returnValue(pending);

      await click(save());

      expect(kind('stage').disabled).toBeTrue();
      expect(topic('jazz').disabled).toBeTrue();
      pending.next({ kinds: ['concerts'], interests: [] });
      pending.complete();
    });

    it('offers a retry, and no skip, when the catalogue is down', async () => {
      await render(
        { kinds: ['concerts'] },
        false,
        throwError(() => new Error('down')),
      );

      expect(error()?.textContent).toContain('INTERESTS.load-error');
      expect(element.textContent).not.toContain('INTERESTS.loading');
      expect(footerButton('INTERESTS.skip')).toBeUndefined();

      interestsService.getCatalog.and.returnValue(of(CATALOG));
      await click(footerButton('INTERESTS.retry'));

      expect(error()).toBeNull();
      expect(kind('concerts')).toBeDefined();
    });
  });

  describe('leaving with changes', () => {
    beforeEach(async () => {
      await render({ kinds: ['concerts'], interests: ['jazz'] });
    });

    it('leaves without asking when nothing changed', () => {
      expect(fixture.componentInstance.confirmLeave()).toBeTrue();
    });

    it('saves and leaves when the user agrees', async () => {
      await click(kind('stage'));

      const leave = fixture.componentInstance.confirmLeave();
      await click(modalButton(0));

      expect(await leave).toBeTrue();
      expect(interestsService.replaceUserInterests).toHaveBeenCalledTimes(1);
    });

    it('leaves without saving when the user declines', async () => {
      await click(topic('rock'));

      const leave = fixture.componentInstance.confirmLeave();
      await click(modalButton(1));

      expect(await leave).toBeTrue();
      expect(interestsService.replaceUserInterests).not.toHaveBeenCalled();
    });

    it('stays on the page when the modal is dismissed with Escape', async () => {
      await click(topic('rock'));

      const leave = fixture.componentInstance.confirmLeave();
      element.querySelector('dialog')!.dispatchEvent(new Event('cancel'));

      expect(await leave).toBeFalse();
    });

    it('stays and explains why when saving with no kind', async () => {
      await click(kind('concerts'));

      const leave = fixture.componentInstance.confirmLeave();
      await click(modalButton(0));

      expect(await leave).toBeFalse();
      expect(error()?.textContent).toContain('INTERESTS.selection-error');
      expect(interestsService.replaceUserInterests).not.toHaveBeenCalled();
    });

    it('stays and shows an error when saving fails', async () => {
      interestsService.replaceUserInterests.and.returnValue(throwError(() => new Error('down')));
      await click(topic('rock'));

      const leave = fixture.componentInstance.confirmLeave();
      await click(modalButton(0));

      expect(await leave).toBeFalse();
      expect(error()?.textContent).toContain('INTERESTS.save-error');
    });

    it('clears the error when the picks change', async () => {
      await click(kind('concerts'));
      const leave = fixture.componentInstance.confirmLeave();
      await click(modalButton(0));
      await leave;

      await click(kind('stage'));

      expect(error()).toBeNull();
    });
  });
});

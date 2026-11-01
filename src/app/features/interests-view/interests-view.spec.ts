import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { InterestCatalog, UserInterests } from '../../core/models/interests/interest.model';
import { UserProfile } from '../../core/models/users/user-profile.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { InterestsService } from '../../core/services/interests/interests.service';
import { InterestsView } from './interests-view';

const CATALOG: InterestCatalog = {
  minSelections: 2,
  maxSelections: 3,
  categories: [
    {
      key: 'music',
      labelPl: 'Muzyka',
      labelEn: 'Music',
      interests: ['jazz', 'rock', 'opera', 'pop'].map((key) => ({
        key,
        labelPl: key,
        labelEn: key,
      })),
    },
  ],
};

describe('InterestsView', () => {
  let fixture: ComponentFixture<InterestsView>;
  let element: HTMLElement;
  const currentUser = signal<Partial<UserProfile> | null>(null);
  const authService = {
    currentUser,
    userId: () => 'user-1',
  };
  const interestsService = jasmine.createSpyObj<InterestsService>('InterestsService', [
    'getCatalog',
    'getUserInterests',
    'replaceUserInterests',
  ]);

  const tile = (text: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('.interests__tiles button')].find(
      (button) => button.textContent?.trim() === text,
    )!;
  const saveButton = () => element.querySelector<HTMLButtonElement>('.interests__footer button')!;
  const footerButton = (text: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('.interests__footer button')].find(
      (button) => button.textContent?.trim() === text,
    )!;
  const modalButton = (index: number) =>
    element.querySelectorAll<HTMLButtonElement>('app-modal-window button')[index];
  const error = () => element.querySelector('.interests__error');

  async function render(
    saved: string[] = [],
    interestsSelected = true,
    catalog: Observable<InterestCatalog> = of(CATALOG),
  ) {
    currentUser.set({ interestsSelected });
    interestsService.getCatalog.and.returnValue(catalog);
    interestsService.getUserInterests.and.returnValue(of({ interests: saved }));
    interestsService.replaceUserInterests.and.callFake((_id, interests) => of({ interests }));
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

  beforeEach(() => interestsService.replaceUserInterests.calls.reset());

  it('shows interests only after their category is clicked', async () => {
    await render();
    expect(tile('jazz')).toBeUndefined();

    await click(tile('Muzyka'));

    expect(tile('jazz')).toBeDefined();
  });

  it('does not count a category as a selection', async () => {
    await render();

    await click(tile('Muzyka'));

    expect(saveButton().disabled).toBeTrue();
  });

  it('blocks more selections at the limit', async () => {
    await render();
    await click(tile('Muzyka'));

    await click(tile('jazz'));
    await click(tile('rock'));
    await click(tile('opera'));

    expect(tile('pop').disabled).toBeTrue();
    expect(tile('jazz').disabled).toBeFalse();
  });

  it('sends only the selected interests on save', async () => {
    await render();
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    await click(tile('Muzyka'));
    await click(tile('jazz'));
    await click(tile('rock'));

    await click(saveButton());

    expect(interestsService.replaceUserInterests).toHaveBeenCalledOnceWith(
      'user-1',
      jasmine.arrayWithExactContents(['jazz', 'rock']),
    );
  });

  it('shows an error instead of the loading text when the catalogue fails', async () => {
    await render(
      [],
      false,
      throwError(() => new Error('down')),
    );

    expect(error()?.textContent).toContain('INTERESTS.load-error');
    expect(element.textContent).not.toContain('INTERESTS.loading');
  });

  it('offers a retry after a catalogue failure and recovers', async () => {
    await render(
      [],
      false,
      throwError(() => new Error('down')),
    );
    interestsService.getCatalog.and.returnValue(of(CATALOG));

    await click(footerButton('INTERESTS.retry'));

    expect(error()).toBeNull();
    expect(tile('Muzyka')).toBeDefined();
  });

  it('lets a new user skip the selection when the catalogue is down', async () => {
    await render(
      [],
      false,
      throwError(() => new Error('down')),
    );
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.dismissed.subscribe(dismissed);

    await click(footerButton('INTERESTS.skip'));

    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('offers no skip when editing a saved selection', async () => {
    await render(
      ['jazz'],
      true,
      throwError(() => new Error('down')),
    );

    expect(footerButton('INTERESTS.skip')).toBeUndefined();
    expect(footerButton('INTERESTS.retry')).toBeDefined();
  });

  it('locks the interests while saving', async () => {
    await render([], false);
    const pending = new Subject<UserInterests>();
    interestsService.replaceUserInterests.and.returnValue(pending);
    await click(tile('Muzyka'));
    await click(tile('jazz'));
    await click(tile('rock'));

    await click(saveButton());

    expect(tile('opera').disabled).toBeTrue();
    expect(tile('jazz').disabled).toBeTrue();
    pending.next({ interests: [] });
    pending.complete();
  });

  it('does not ask for a saved selection during the first selection', async () => {
    interestsService.getUserInterests.calls.reset();

    await render([], false);

    expect(interestsService.getUserInterests).not.toHaveBeenCalled();
    expect(tile('Muzyka')).toBeDefined();
  });

  it('stays on the current page after the first save', async () => {
    await render([], false);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    await click(tile('Muzyka'));
    await click(tile('jazz'));
    await click(tile('rock'));

    await click(saveButton());

    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes back to the profile after a later save', async () => {
    await render(['jazz', 'rock']);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    await click(saveButton());

    expect(navigate).toHaveBeenCalledOnceWith('/profile');
  });

  it('leaves without asking when nothing changed', async () => {
    await render(['jazz', 'rock']);

    expect(fixture.componentInstance.confirmLeave()).toBeTrue();
  });

  it('saves changes and leaves when the user agrees', async () => {
    await render(['jazz', 'rock']);
    await click(tile('Muzyka (2)'));
    await click(tile('opera'));

    const leave = fixture.componentInstance.confirmLeave();
    await click(modalButton(0));

    expect(await leave).toBeTrue();
    expect(interestsService.replaceUserInterests).toHaveBeenCalledTimes(1);
  });

  it('leaves without saving when the user declines', async () => {
    await render(['jazz', 'rock']);
    await click(tile('Muzyka (2)'));
    await click(tile('opera'));

    const leave = fixture.componentInstance.confirmLeave();
    await click(modalButton(1));

    expect(await leave).toBeTrue();
    expect(interestsService.replaceUserInterests).not.toHaveBeenCalled();
  });

  it('stays on the page when the modal is dismissed with Escape', async () => {
    await render(['jazz', 'rock']);
    await click(tile('Muzyka (2)'));
    await click(tile('opera'));

    const leave = fixture.componentInstance.confirmLeave();
    element.querySelector('dialog')!.dispatchEvent(new Event('cancel'));

    expect(await leave).toBeFalse();
  });

  it('stays and explains why when saving a selection under the minimum', async () => {
    await render(['jazz', 'rock']);
    await click(tile('Muzyka (2)'));
    await click(tile('jazz'));

    const leave = fixture.componentInstance.confirmLeave();
    await click(modalButton(0));

    expect(await leave).toBeFalse();
    expect(error()?.textContent).toContain('INTERESTS.selection-error');
    expect(interestsService.replaceUserInterests).not.toHaveBeenCalled();
  });

  it('stays and shows an error when saving fails', async () => {
    await render(['jazz', 'rock']);
    interestsService.replaceUserInterests.and.returnValue(throwError(() => new Error('down')));
    await click(tile('Muzyka (2)'));
    await click(tile('opera'));

    const leave = fixture.componentInstance.confirmLeave();
    await click(modalButton(0));

    expect(await leave).toBeFalse();
    expect(error()?.textContent).toContain('INTERESTS.save-error');
  });

  it('clears the error when the selection changes', async () => {
    await render(['jazz', 'rock']);
    await click(tile('Muzyka (2)'));
    await click(tile('jazz'));
    const leave = fixture.componentInstance.confirmLeave();
    await click(modalButton(0));
    await leave;

    await click(tile('opera'));

    expect(error()).toBeNull();
  });

  it('sends one request when save is clicked twice at once', async () => {
    await render();
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    await click(tile('Muzyka'));
    await click(tile('jazz'));
    await click(tile('rock'));

    saveButton().click();
    await click(saveButton());

    expect(interestsService.replaceUserInterests).toHaveBeenCalledTimes(1);
  });

  it('does not ask about leaving when only a category was opened', async () => {
    await render(['jazz', 'rock']);

    await click(tile('Muzyka (2)'));

    expect(fixture.componentInstance.confirmLeave()).toBeTrue();
  });

  it('shows how many interests are selected in a category', async () => {
    await render(['jazz', 'rock']);

    expect(tile('Muzyka (2)')).toBeDefined();
  });

  it('marks the flag on the user after saving', async () => {
    await render([], false);
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    await click(tile('Muzyka'));
    await click(tile('jazz'));
    await click(tile('rock'));

    await click(saveButton());

    expect(currentUser()?.interestsSelected).toBeTrue();
    expect(fixture.componentInstance.confirmLeave()).toBeTrue();
  });
});

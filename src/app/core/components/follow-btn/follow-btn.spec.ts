import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { FollowBtn } from './follow-btn';

describe('FollowBtn', () => {
  let fixture: ComponentFixture<FollowBtn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FollowBtn, TranslateModule.forRoot()],
    });
    fixture = TestBed.createComponent(FollowBtn);
  });

  const button = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;

  it('asks to follow while not following', () => {
    fixture.detectChanges();
    expect(button().className).toContain('btn--primary');
    expect(button().textContent).toContain('PROFILE.follow');
  });

  it('says you follow, in the quieter style', () => {
    fixture.componentRef.setInput('following', true);
    fixture.detectChanges();
    expect(button().className).toContain('btn--secondary');
    expect(button().textContent).toContain('PROFILE.followingThem');
  });

  it('emits on a tap, and not while busy', () => {
    const taps = jasmine.createSpy('toggled');
    fixture.componentInstance.toggled.subscribe(taps);
    fixture.detectChanges();
    button().click();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    button().click();
    expect(taps).toHaveBeenCalledTimes(1);
  });
});

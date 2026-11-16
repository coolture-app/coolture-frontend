import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { RelationPill } from './relation-pill';

describe('RelationPill', () => {
  let fixture: ComponentFixture<RelationPill>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RelationPill, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(RelationPill);
  });

  function render(following: boolean, followsYou: boolean): string {
    fixture.componentRef.setInput('following', following);
    fixture.componentRef.setInput('followsYou', followsYou);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
  }

  it('says friends when you follow each other', () => {
    expect(render(true, true)).toBe('PROFILE.friends');
  });

  it('says they follow you when only they do', () => {
    expect(render(false, true)).toBe('PROFILE.followsYou');
  });

  it('says nothing when they don’t follow you', () => {
    expect(render(true, false)).toBe('');
    expect(render(false, false)).toBe('');
  });
});

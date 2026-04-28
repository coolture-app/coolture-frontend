import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowListComponent } from './follow-list';

describe('FollowListComponent', () => {
  let component: FollowListComponent;
  let fixture: ComponentFixture<FollowListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FollowListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FollowListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

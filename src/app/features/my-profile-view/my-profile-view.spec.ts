import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserProfileView } from './my-profile-view';

describe('UserProfileView', () => {
  let component: UserProfileView;
  let fixture: ComponentFixture<UserProfileView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileView],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

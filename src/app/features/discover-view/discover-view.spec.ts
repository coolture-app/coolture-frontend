import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscoverView } from './discover-view';

describe('DiscoverView', () => {
  let component: DiscoverView;
  let fixture: ComponentFixture<DiscoverView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscoverView],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapPopup } from './map-popup';

describe('MapPopup', () => {
  let component: MapPopup;
  let fixture: ComponentFixture<MapPopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapPopup],
    }).compileComponents();

    fixture = TestBed.createComponent(MapPopup);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('postId', 'p1');
    fixture.componentRef.setInput('popupTitle', 'Title');
    fixture.componentRef.setInput('popupBody', 'Body');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the place under the title, and nothing for a post without one', async () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.popup-place')).toBeNull();

    fixture.componentRef.setInput('place', 'Ergo Arena, Gdańsk');
    await fixture.whenStable();

    expect(element.querySelector('.popup-place')?.textContent?.trim()).toBe('Ergo Arena, Gdańsk');
  });
});

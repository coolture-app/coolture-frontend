import { Component, Output } from '@angular/core';
import { EventEmitter } from '@angular/core';

@Component({
  selector: 'app-switch',
  imports: [],
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
})
export class Switch {
  @Output() switchState = new EventEmitter<boolean>();

  toogleState(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.switchState.emit(isChecked);
  }
}

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { DishListResponse } from '@app/models/dishes/dish-list-response.model';
import { CustomButtonComponent } from '@app/shared/custom-components/custom-button/custom-button.component';

@Component({
  selector: 'app-dish-modal',
  standalone: true,
  imports: [CustomButtonComponent],
  templateUrl: './dish-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './dish-modal.component.scss',
})
export class DishModalComponent {
  @Input() dish!: DishListResponse;
  @Input() preOrderEnabled = false;
  @Output() closed = new EventEmitter<void>();
  @Output() preOrderClicked = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }
}

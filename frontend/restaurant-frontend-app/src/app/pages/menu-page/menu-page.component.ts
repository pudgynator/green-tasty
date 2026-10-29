import {Component, OnInit, ChangeDetectionStrategy, inject} from '@angular/core';
import { DishCardComponent } from '@app/shared/custom-components/dish-card/dish-card.component';
import { DishesService } from '@app/services/dishes/dishes.service';
import { DishListResponse } from '@app/models/dishes/dish-list-response.model';
import { MainCoverImageComponent } from '@app/shared/custom-components/main-cover-image/main-cover-image.component';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DishSort } from '@app/models/enums/dish-sort.model';
import { DishType } from '@app/models/enums/dish-type.model';
import { DishTypeLabels } from '@app/shared/mappers/dish-enum.mapper';
import { DishModalComponent } from '@app/components/dish-modal/dish-modal.component';
import { PreOrdersService } from '@app/services/pre-orders/pre-orders.service';
import {ToastService} from '@app/services/toast/toast.service';
import { ReservationService } from '@app/services/reservation/reservation.service';
import { AuthenticationService } from '@app/auth/services/authentication.service';
import { Reservation, ReservationStatus } from '@app/models/reservations/reservation.model';

@Component({
  selector: 'app-menu-page',
  standalone: true,
  imports: [
    RouterModule,
    DishCardComponent,
    MainCoverImageComponent,
    DishModalComponent
  ],
  templateUrl: './menu-page.component.html',
  styleUrl: './menu-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [DishesService],
})
export class MenuPageComponent implements OnInit {
  private toast = inject(ToastService);
  dishes: DishListResponse[] = [];
  filteredDishes: DishListResponse[] = [];

  isPreOrderEnabled = false;
  preOrderReservationId?: string;
  preOrderReservationLabel?: string;

  readonly sortChoices: { value: DishSort; label: string }[] = [
    { value: DishSort.PopularityDescending, label: 'Recommended' },
    { value: DishSort.PriceAscending, label: 'Price: Low to high' },
    { value: DishSort.PriceDescending, label: 'Price: High to low' },
  ];

  menuCategories = Object.values(DishType);
  menuCategoryLabels = DishTypeLabels;

  selectedCategory: DishType | null = null; // initially show all
  selectedSort: DishSort = DishSort.PopularityDescending;

  private readonly dishesService = inject(DishesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private  readonly orderService = inject(PreOrdersService);
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthenticationService);
  private reservationFromAccount = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const preOrder = params['preOrder'];
      if (preOrder) {
        this.reservationFromAccount = false;
        this.isPreOrderEnabled = true;
        this.preOrderReservationId = params['reservationId'];
        this.preOrderReservationLabel = params['reservationLabel'];
        if (!this.preOrderReservationId) {
          console.error('Pre-order is enabled but no reservation ID provided.');
          this.toast.error('Pre-order is enabled but no reservation ID provided.', 'Error');
          this.isPreOrderEnabled = false;
        }
      } else if (!this.reservationFromAccount) {
        this.isPreOrderEnabled = false;
      }

      const category = params['category'] as DishType;
      const sort = params['sort'] as DishSort;

      this.selectedCategory =
        category && Object.values(DishType).includes(category) ? category : null;
      this.selectedSort =
        sort && Object.values(DishSort).includes(sort) ? sort : DishSort.PopularityDescending;

      if (!preOrder && !this.reservationFromAccount) {
        this.attachUpcomingReservation();
      }

      this.loadDishes();
    });
  }

  private attachUpcomingReservation(): void {
    if (!this.auth.getToken()) {
      return;
    }

    this.reservationService.getReservationsForUser$().subscribe({
      next: (reservations) => {
        const upcoming = reservations
          .filter((reservation) => this.isUpcoming(reservation))
          .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime())[0];

        if (!upcoming) {
          return;
        }

        const start = new Date(upcoming.startTime);
        const end = new Date(upcoming.endTime);
        this.reservationFromAccount = true;
        this.isPreOrderEnabled = true;
        this.preOrderReservationId = upcoming.id;
        this.preOrderReservationLabel = [
          upcoming.locationAddress,
          start.toLocaleDateString(),
          `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        ].join(', ');
      },
    });
  }

  private isUpcoming(reservation: Reservation): boolean {
    const status = reservation.status as unknown as number | string;
    const cancelled = status === ReservationStatus.Cancelled || status === 'Cancelled';
    return !cancelled && new Date(reservation.endTime).getTime() > Date.now();
  }

  loadDishes(): void {
    const category = this.selectedCategory ?? undefined;
    const sort = this.selectedSort;

    this.dishesService.getDishes(category, sort).subscribe((data) => {
      this.dishes = data.map((dish) => ({
        ...dish,
        imageUrl: dish.imageUrl || 'assets/img/dish.png',
        name: dish.name || 'Unknown Dish',
        price: dish.price || 0,
        weight: dish.weight || 'N/A',
        description: dish.description || 'N/A',
        state: dish.state || 'N/A',
        dishType: dish.dishType || 'N/A',
        calories: dish.calories || '0',
        proteins: dish.proteins || '0',
        fats: dish.fats || '0',
        carbohydrates: dish.carbohydrates || '0',
        vitamins: dish.vitamins || '0',
      }));

      this.filteredDishes = this.dishes;
    });
  }

  selectAll(): void {
    if (this.selectedCategory === null) {
      return;
    }
    this.onCategorySelected(this.selectedCategory);
  }

  onCategorySelected(category: DishType): void {
    this.selectedCategory = this.selectedCategory === category ? null : category;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: this.selectedCategory || null,
        sort: this.selectedSort,
      },
      queryParamsHandling: 'merge',
    });
  }

  onSortChanged(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const sort = selectElement.value as DishSort;
    this.selectedSort = sort;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: this.selectedCategory || null,
        sort: this.selectedSort,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  selectedDish: DishListResponse | null = null;

  openModal(dish: DishListResponse) {
    this.selectedDish = dish;
  }

  closeModal() {
    this.selectedDish = null;
  }

  addDishToCart(dish: DishListResponse): void {
    this.orderService
      .addDishToPreOrderByReservationId(this.preOrderReservationId!, dish, 1)
      .subscribe({
        next: () => {
          this.toast.success('Dish added to cart successfully!', 'Success');
        },
        error: (err) => {
          this.toast.error((err as Error).message, 'Error');
        },
      });
  }
}

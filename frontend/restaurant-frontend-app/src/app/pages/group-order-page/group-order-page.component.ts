import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, forkJoin, interval, Observable, Subscription } from 'rxjs';
import { catchError, exhaustMap, filter, finalize, map, switchMap, tap } from 'rxjs/operators';
import { ParticipantCardComponent } from '@app/components/group-orders/participant-card/participant-card.component';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GroupStatusResponse } from '@app/models/group-orders/group-status.model';
import { Participant } from '@app/models/group-orders/participant.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { ToastService } from '@app/services/toast/toast.service';
import { ModalComponent } from '@app/shared/custom-components/modal/modal.component';
import { consolidatePreOrder } from '@app/shared/helpers/consolidate-pre-order';

const SYNC_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-group-order-page',
  imports: [ParticipantCardComponent, ModalComponent, CurrencyPipe, DatePipe],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GroupOrderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly groupOrders = inject(GroupOrdersService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservationId = this.route.snapshot.paramMap.get('reservationId') ?? '';

  private loadToken = 0;
  private syncing = false;
  private syncSubscription: Subscription | null = null;

  readonly loading = signal(true);
  readonly errorStatus = signal<number | null>(null);
  readonly invite = signal<GuestInvite | null>(null);
  readonly sessions = signal<GroupSessionsResponse | null>(null);
  readonly ownerSessionId = signal<string | null>(null);
  readonly groupStatus = signal<GroupStatusResponse | null>(null);
  readonly updatedAt = signal<Date | null>(null);
  readonly refreshFailed = signal(false);
  readonly submitting = signal(false);
  readonly confirmOpen = signal(false);
  readonly removeTarget = signal<Participant | null>(null);
  readonly removing = signal(false);

  readonly participants = computed(() => this.sessions()?.participants ?? []);
  readonly consolidated = computed(() => consolidatePreOrder(this.participants()));
  readonly isOpen = computed(() => this.groupStatus()?.status === 'Open');
  readonly hasAnyDishes = computed(() => this.participants().some((person) => person.items.length > 0));
  readonly canSubmit = computed(
    () => this.isOpen() && !this.submitting() && this.consolidated().items.length > 0,
  );

  readonly statusLabel = computed(() => {
    const current = this.groupStatus()?.status;
    if (current === 'Open') return 'Collecting pre-orders';
    if (current === 'Submitted') return 'Sent to Restaurant';
    if (current === 'Closed') return 'Closed';
    return '';
  });

  readonly pendingNotice = computed(() => {
    const waiting = this.participants().filter((person) => !person.isSubmitted).length;
    if (waiting === 0) return '';
    const verb = waiting === 1 ? "participant hasn't" : "participants haven't";
    return `${waiting} ${verb} submitted their cart yet — their dishes won't be included in the order`;
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopSync());
    this.load();
  }

  reload(): void {
    this.load();
  }

  refresh(): void {
    this.pullSilent().subscribe();
  }

  askSubmit(): void {
    if (!this.canSubmit()) return;
    this.confirmOpen.set(true);
  }

  closeSubmit(): void {
    if (this.submitting()) return;
    this.confirmOpen.set(false);
  }

  confirmSubmit(): void {
    if (this.submitting() || !this.canSubmit()) return;
    const groupId = this.invite()?.GroupReservationId;
    if (!groupId) return;

    this.submitting.set(true);
    this.groupOrders
      .submit$(groupId, this.reservationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Pre-order sent to the restaurant');
          this.groupStatus.update((current) => (current ? { ...current, status: 'Submitted' } : current));
          this.submitting.set(false);
          this.confirmOpen.set(false);
          this.stopSync();
        },
        error: () => {
          this.submitting.set(false);
          this.confirmOpen.set(false);
        },
      });
  }

  askRemove(person: Participant): void {
    if (!this.isOpen()) return;
    this.removeTarget.set(person);
  }

  closeRemove(): void {
    if (this.removing()) return;
    this.removeTarget.set(null);
  }

  confirmRemove(): void {
    const person = this.removeTarget();
    const groupId = this.invite()?.GroupReservationId;
    if (!person || !groupId || this.removing()) return;

    this.removing.set(true);
    this.groupOrders
      .removeSession$(groupId, person.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.removing.set(false);
          this.removeTarget.set(null);
        },
        error: () => {
          this.removing.set(false);
          this.removeTarget.set(null);
        },
      });
  }

  private load(): void {
    const currentLoad = ++this.loadToken;
    this.loading.set(true);
    this.errorStatus.set(null);

    if (!this.reservationId) {
      this.loading.set(false);
      this.errorStatus.set(404);
      return;
    }

    this.groupOrders
      .getGroupInvite$(this.reservationId)
      .pipe(
        switchMap((invite) =>
          forkJoin({
            sessions: this.groupOrders.getSessions$(invite.GroupReservationId),
            ownerSessionId: this.groupOrders.getOwnerSessionId$(this.reservationId),
            groupStatus: this.groupOrders.getStatus$(invite.GroupReservationId),
          }).pipe(map((result) => ({ invite, ...result }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ invite, sessions, ownerSessionId, groupStatus }) => {
          if (currentLoad !== this.loadToken) return;
          this.invite.set(invite);
          this.sessions.set(sessions);
          this.ownerSessionId.set(ownerSessionId);
          this.groupStatus.set(groupStatus);
          this.refreshFailed.set(false);
          this.updatedAt.set(new Date());
          this.loading.set(false);
          this.startSync();
        },
        error: (error: unknown) => {
          if (currentLoad !== this.loadToken) return;
          this.loading.set(false);
          this.errorStatus.set(error instanceof HttpErrorResponse ? error.status : 0);
        },
      });
  }

  private startSync(): void {
    if (this.syncSubscription || !this.isOpen()) return;

    this.syncSubscription = interval(SYNC_INTERVAL_MS)
      .pipe(
        filter(() => this.isOpen()),
        exhaustMap(() => this.pullSilent()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private stopSync(): void {
    this.syncSubscription?.unsubscribe();
    this.syncSubscription = null;
  }

  /** Background refresh. Skips when a request is already in flight (exhaust). */
  private pullSilent(): Observable<void> {
    if (this.syncing || !this.isOpen()) return EMPTY;

    const groupId = this.invite()?.GroupReservationId;
    if (!groupId) return EMPTY;

    this.syncing = true;
    return forkJoin({
      sessions: this.groupOrders.getSessions$(groupId, { silent: true }),
      groupStatus: this.groupOrders.getStatus$(groupId, { silent: true }),
    }).pipe(
      tap(({ sessions, groupStatus }) => {
        this.sessions.set(sessions);
        this.groupStatus.set(groupStatus);
        this.refreshFailed.set(false);
        this.updatedAt.set(new Date());
      }),
      catchError(() => {
        this.refreshFailed.set(true);
        return EMPTY;
      }),
      finalize(() => {
        this.syncing = false;
        if (!this.isOpen()) this.stopSync();
      }),
      map(() => undefined),
    );
  }
}

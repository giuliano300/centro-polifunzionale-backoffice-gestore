import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Booking, BookingWithPayments, Payment } from '../../core/models';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'gestore-bookings',
  imports: [NgIf, NgFor, ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent {
  private fb = inject(FormBuilder);
  bookings: BookingWithPayments[] = [];
  isLoading = true;
  payingBookingId = '';
  checkoutProvider = '';
  message = '';
  filters = this.fb.group({
    start: [null as Date | null],
    end: [null as Date | null],
    status: [''],
    search: [''],
  });

  constructor(private api: ApiService) {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.message = '';
    const filters = this.filters.getRawValue();
    this.api.bookings({
      start: this.formatApiDate(filters.start),
      end: this.formatApiDate(filters.end),
      status: filters.status || '',
      search: filters.search || '',
    }).subscribe({
      next: (bookings) => {
        this.bookings = bookings;
        this.isLoading = false;
      },
      error: () => {
        this.message = 'Prenotazioni non disponibili.';
        this.isLoading = false;
      },
    });
  }

  clear(): void {
    this.filters.reset({ start: null, end: null, status: '', search: '' });
    this.load();
  }

  paymentStatus(item: BookingWithPayments): string {
    return item.payments.find((payment) => this.normalizedPaymentStatus(payment) === 'PAID')?.status
      || item.payments[0]?.status?.toUpperCase()
      || 'PENDING';
  }

  pendingPayment(item: BookingWithPayments): Payment | undefined {
    if (item.payments.some((payment) => this.normalizedPaymentStatus(payment) === 'PAID')) {
      return undefined;
    }

    return item.payments.find((payment) => this.normalizedPaymentStatus(payment) === 'PENDING');
  }

  isPayable(item: BookingWithPayments): boolean {
    return item.booking.status !== 'cancelled'
      && !item.payments.some((payment) => this.normalizedPaymentStatus(payment) === 'PAID');
  }

  paymentAmount(item: BookingWithPayments): number {
    return this.pendingPayment(item)?.amount || item.payments[0]?.amount || 0;
  }

  markPaid(item: BookingWithPayments): void {
    if (!this.isPayable(item) || this.payingBookingId === item.booking._id) {
      return;
    }

    this.payingBookingId = item.booking._id;
    this.api.markBookingPaid(item.booking._id, this.paymentAmount(item)).subscribe({
      next: () => {
        this.message = 'Pagamento simulato correttamente.';
        this.payingBookingId = '';
        this.load();
      },
      error: (error) => {
        this.message = error?.error?.message || 'Pagamento non registrato.';
        this.payingBookingId = '';
      },
    });
  }

  startCheckout(item: BookingWithPayments, provider: 'stripe' | 'paypal' | 'nexi'): void {
    if (!this.isPayable(item) || this.payingBookingId === item.booking._id) {
      return;
    }

    this.payingBookingId = item.booking._id;
    this.checkoutProvider = provider;
    this.message = '';
    this.api.createCheckout(item.booking._id, provider).subscribe({
      next: (checkout) => {
        window.location.href = checkout.checkoutUrl;
      },
      error: (error) => {
        this.message = error?.error?.message || `${provider} non configurato o non disponibile.`;
        this.payingBookingId = '';
        this.checkoutProvider = '';
      },
    });
  }

  spaceName(booking: Booking): string {
    return typeof booking.space === 'string' ? '-' : booking.space?.name || '-';
  }

  formatDate(value: string | Date): string {
    return new Date(value).toLocaleDateString('it-IT');
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  formatApiDate(value?: Date | string | null): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizedPaymentStatus(payment: Payment): string {
    return String(payment.status || '').toUpperCase();
  }
}

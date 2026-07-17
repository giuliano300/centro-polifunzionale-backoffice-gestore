import { Component } from '@angular/core';
import { forkJoin } from 'rxjs';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Booking, BookingWithPayments, Course, Payment, Space } from '../../core/models';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'gestore-dashboard',
  imports: [NgIf, NgFor, RouterLink, MatButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  isLoading = true;
  spaces: Space[] = [];
  bookings: BookingWithPayments[] = [];
  courses: Course[] = [];
  payments: Payment[] = [];

  constructor(private api: ApiService) {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    forkJoin({
      spaces: this.api.spaces(),
      bookings: this.api.bookings(),
      courses: this.api.courses(),
      payments: this.api.payments(),
    }).subscribe({
      next: (data) => {
        this.spaces = data.spaces;
        this.bookings = data.bookings;
        this.courses = data.courses;
        this.payments = data.payments;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  get paidRevenue(): number {
    return this.payments.filter((payment) => payment.status === 'PAID').reduce((sum, payment) => sum + payment.amount, 0);
  }

  get pendingAmount(): number {
    return this.payments.filter((payment) => payment.status === 'PENDING').reduce((sum, payment) => sum + payment.amount, 0);
  }

  get upcomingBookings() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.bookings
      .map((item) => item.booking)
      .filter((booking) => new Date(booking.date) >= today)
      .slice(0, 5);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  formatDate(value: string | Date): string {
    return new Date(value).toLocaleDateString('it-IT');
  }

  spaceName(item: BookingWithPayments['booking']): string {
    return typeof item.space === 'string' ? '-' : item.space?.name || '-';
  }

  bookingStatusLabel(status: Booking['status']): string {
    const labels: Record<Booking['status'], string> = {
      pending: 'In attesa',
      confirmed: 'Confermata',
      cancellation_requested: 'Richiesta annullamento',
      cancelled: 'Annullata',
    };
    return labels[status] || 'In attesa';
  }
}

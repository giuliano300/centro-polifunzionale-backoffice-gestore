import { Component, ViewChild, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCalendar, MatCalendarCellClassFunction, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Booking, BookingWithPayments, Course, Payment } from '../../core/models';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'gestore-bookings',
  imports: [NgIf, NgFor, RouterLink, ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent {
  private fb = inject(FormBuilder);
  calendarBookings: BookingWithPayments[] = [];
  listBookings: BookingWithPayments[] = [];
  courses: Course[] = [];
  selectedCalendarDate: Date | null = this.today();
  selectedCalendarBooking: BookingWithPayments | null = null;
  viewMode: 'calendar' | 'list' = 'calendar';
  isLoading = true;
  isListLoading = false;
  listPage = 1;
  listLimit = 10;
  listTotal = 0;
  payingBookingId = '';
  checkoutProvider = '';
  cancellingBookingId = '';
  cancellationTarget: BookingWithPayments | null = null;
  message = '';

  @ViewChild(MatCalendar) calendar!: MatCalendar<Date>;

  listFilters = this.fb.group({
    start: [null as Date | null],
    end: [null as Date | null],
    status: ['' as Booking['status'] | ''],
  });

  constructor(private api: ApiService) {
    this.loadCourses();
    this.load();
    this.loadList();
  }

  dateClass: MatCalendarCellClassFunction<Date> = (cellDate) => {
    return this.hasBookingsOnDate(cellDate) ? 'has-bookings' : '';
  };

  load(): void {
    this.isLoading = true;
    this.message = '';
    this.api.bookings().subscribe({
      next: (items) => {
        this.calendarBookings = items;
        this.dateClass = (cellDate) => this.hasBookingsOnDate(cellDate) ? 'has-bookings' : '';
        this.syncSelectedCalendarBooking();
        this.isLoading = false;
        setTimeout(() => this.calendar?.updateTodaysDate());
      },
      error: () => {
        this.message = 'Prenotazioni non disponibili.';
        this.isLoading = false;
      },
    });
  }

  loadCourses(): void {
    this.api.courses().subscribe({
      next: (courses) => {
        this.courses = courses;
      },
    });
  }

  setViewMode(mode: 'calendar' | 'list'): void {
    this.viewMode = mode;
    if (mode === 'list' && !this.listBookings.length) {
      this.loadList();
    }
  }

  loadList(): void {
    this.isListLoading = true;
    const filters = this.listFilters.getRawValue();
    this.api.bookingsPage({
      start: this.formatApiDate(filters.start),
      end: this.formatApiDate(filters.end),
      status: filters.status || '',
      page: String(this.listPage),
      limit: String(this.listLimit),
    }).subscribe({
      next: (result) => {
        this.listBookings = result.items;
        this.listTotal = result.total;
        this.listPage = result.page;
        this.listLimit = result.limit;
        this.isListLoading = false;
      },
      error: () => {
        this.message = 'Lista prenotazioni non disponibile.';
        this.isListLoading = false;
      },
    });
  }

  applyListFilters(): void {
    this.listPage = 1;
    this.loadList();
  }

  clearListFilters(): void {
    this.listFilters.reset({ start: null, end: null, status: '' });
    this.listPage = 1;
    this.loadList();
  }

  listTotalPages(): number {
    return Math.max(Math.ceil(this.listTotal / this.listLimit), 1);
  }

  listPageStart(): number {
    if (!this.listTotal) {
      return 0;
    }
    return (this.listPage - 1) * this.listLimit + 1;
  }

  listPageEnd(): number {
    return Math.min(this.listPage * this.listLimit, this.listTotal);
  }

  changeListLimit(limit: number): void {
    this.listLimit = limit;
    this.listPage = 1;
    this.loadList();
  }

  previousListPage(): void {
    if (this.listPage <= 1) {
      return;
    }
    this.listPage -= 1;
    this.loadList();
  }

  nextListPage(): void {
    if (this.listPage >= this.listTotalPages()) {
      return;
    }
    this.listPage += 1;
    this.loadList();
  }

  selectListBooking(item: BookingWithPayments): void {
    const selected = new Date(item.booking.date);
    selected.setHours(0, 0, 0, 0);
    this.selectedCalendarDate = selected;
    this.selectedCalendarBooking = item;
    this.viewMode = 'calendar';
    setTimeout(() => this.calendar?.updateTodaysDate());
  }

  clear(): void {
    this.selectedCalendarDate = null;
    this.selectedCalendarBooking = null;
  }

  selectCalendarDate(date: Date | null): void {
    if (!date) {
      return;
    }

    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    this.selectedCalendarDate = selected;
    this.syncSelectedCalendarBooking();
  }

  selectCalendarBooking(item: BookingWithPayments): void {
    this.selectedCalendarBooking = item;
  }

  selectedDayBookings(): BookingWithPayments[] {
    if (!this.selectedCalendarDate) {
      return [];
    }

    const selectedDate = this.selectedCalendarDate;
    return this.calendarBookings.filter((item) => this.isSameDay(item.booking.date, selectedDate));
  }

  selectedBookingRentalLabel(item: BookingWithPayments): string {
    if (item.booking.rentalMode === 'full_day') {
      return 'Tutta la giornata';
    }

    if (item.booking.rentalUnit === 'workstation') {
      return `Postazione di lavoro${item.booking.workstationQuantity ? ` x${item.booking.workstationQuantity}` : ''}`;
    }

    return 'Stanza intera a frazioni';
  }

  courseForBooking(bookingId: string): Course | undefined {
    return this.courses.find((course) => this.courseBookingId(course) === bookingId);
  }

  courseLinkParams(item: BookingWithPayments): Record<string, string> {
    const course = this.courseForBooking(item.booking._id);
    return course ? { courseId: course._id } : { bookingId: item.booking._id };
  }

  courseActionLabel(item: BookingWithPayments): string {
    return this.courseForBooking(item.booking._id) ? 'Apri corso' : 'Crea corso';
  }

  canOpenCourseFromBooking(item: BookingWithPayments): boolean {
    return item.booking.status !== 'cancelled' && item.booking.status !== 'cancellation_requested';
  }

  canCreateCourseFromBooking(item: BookingWithPayments): boolean {
    return this.isPaid(item)
      && item.booking.status !== 'cancelled'
      && item.booking.status !== 'cancellation_requested'
      && this.canCreateCourseByDeadline(item.booking);
  }

  courseAvailabilityMessage(item: BookingWithPayments): string {
    if (!this.isPaid(item)) {
      return 'Completa il pagamento per creare un corso.';
    }

    if (item.booking.status === 'cancelled') {
      return 'Prenotazione annullata.';
    }

    if (item.booking.status === 'cancellation_requested') {
      return 'Richiesta di annullamento in corso.';
    }

    if (!this.canCreateCourseByDeadline(item.booking)) {
      return this.courseCreationWindowMessage(item.booking);
    }

    return '';
  }

  paymentStatus(item: BookingWithPayments): string {
    return item.payments.find((payment) => this.normalizedPaymentStatus(payment) === 'PAID')?.status
      || item.payments[0]?.status?.toUpperCase()
      || 'PENDING';
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

  paymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'In attesa',
      PAID: 'Pagato',
      FAILED: 'Non riuscito',
      FREE: 'Gratuito',
    };
    return labels[String(status || '').toUpperCase()] || 'In attesa';
  }

  pendingPayment(item: BookingWithPayments): Payment | undefined {
    if (item.payments.some((payment) => this.normalizedPaymentStatus(payment) === 'PAID')) {
      return undefined;
    }

    return item.payments.find((payment) => this.normalizedPaymentStatus(payment) === 'PENDING');
  }

  isPayable(item: BookingWithPayments): boolean {
    return item.booking.status !== 'cancelled'
      && item.booking.status !== 'cancellation_requested'
      && !item.payments.some((payment) => this.normalizedPaymentStatus(payment) === 'PAID')
      && this.externalPaymentAmount(item) > 0;
  }

  canPayCash(item: BookingWithPayments): boolean {
    return this.isPayable(item) && this.isPaymentMethodAllowed(item, 'cash');
  }

  canRequestCancellation(item: BookingWithPayments): boolean {
    return item.booking.status !== 'cancelled'
      && item.booking.status !== 'cancellation_requested'
      && this.isAfterToday(item.booking.date);
  }

  paymentAmount(item: BookingWithPayments): number {
    const payment = this.primaryPayment(item);
    return payment?.totalAmount || ((payment?.amount || 0) + (payment?.walletAmount || 0));
  }

  walletPaymentAmount(item: BookingWithPayments): number {
    return this.primaryPayment(item)?.walletAmount || 0;
  }

  externalPaymentAmount(item: BookingWithPayments): number {
    const payment = this.pendingPayment(item) || this.primaryPayment(item);
    return payment?.externalAmount || payment?.amount || 0;
  }

  externalPaymentLabel(item: BookingWithPayments): string {
    const payment = this.pendingPayment(item) || this.primaryPayment(item);
    const amount = this.externalPaymentAmount(item);
    if (amount <= 0) {
      return 'Nessun pagamento aggiuntivo';
    }

    return `${this.paymentMethodLabel(payment)} ${this.formatCurrency(amount)}`;
  }

  cancellationRefundAmount(item: BookingWithPayments): number {
    return Number(item.cancellationRefundAmount || 0);
  }

  payCash(item: BookingWithPayments): void {
    if (!this.canPayCash(item) || this.payingBookingId === item.booking._id) {
      return;
    }

    this.payingBookingId = item.booking._id;
    this.api.markBookingPaid(item.booking._id, this.externalPaymentAmount(item), 'cash').subscribe({
      next: () => {
        this.message = 'Pagamento in contanti registrato correttamente.';
        this.payingBookingId = '';
        this.loadCourses();
        this.load();
        this.loadList();
      },
      error: (error) => {
        this.message = error?.error?.message || 'Pagamento in contanti non registrato.';
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

  openCancellationDialog(item: BookingWithPayments): void {
    if (!this.canRequestCancellation(item) || this.cancellingBookingId === item.booking._id) {
      return;
    }

    this.cancellationTarget = item;
  }

  closeCancellationDialog(): void {
    if (this.cancellingBookingId) {
      return;
    }
    this.cancellationTarget = null;
  }

  confirmCancellationRequest(): void {
    const item = this.cancellationTarget;
    if (!item || !this.canRequestCancellation(item) || this.cancellingBookingId === item.booking._id) {
      return;
    }

    this.cancellingBookingId = item.booking._id;
    this.message = '';
    this.api.requestBookingCancellation(item.booking._id).subscribe({
      next: () => {
        this.message = 'Richiesta di annullamento inviata.';
        this.cancellingBookingId = '';
        this.cancellationTarget = null;
        this.load();
        this.loadList();
      },
      error: (error) => {
        this.message = error?.error?.message || 'Richiesta di annullamento non inviata.';
        this.cancellingBookingId = '';
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

  private isAfterToday(value: string | Date): boolean {
    const bookingDate = new Date(value);
    const today = new Date();
    bookingDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return bookingDate.getTime() > today.getTime();
  }

  private today(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private isPaid(item: BookingWithPayments): boolean {
    return item.payments.some((payment) => this.normalizedPaymentStatus(payment) === 'PAID');
  }

  private canCreateCourseByDeadline(booking: Booking): boolean {
    const bookingStart = this.bookingStartDate(booking);
    const advanceHours = this.courseCreationAdvanceHours(booking);
    const creationDeadline = new Date(bookingStart.getTime() - (advanceHours * 60 * 60 * 1000));
    return new Date() <= creationDeadline;
  }

  private courseCreationWindowMessage(booking: Booking): string {
    const advanceHours = this.courseCreationAdvanceHours(booking);
    const creationDeadline = new Date(this.bookingStartDate(booking).getTime() - (advanceHours * 60 * 60 * 1000));
    return `Puoi creare il corso solo fino a ${advanceHours} ore prima dell'inizio: entro ${creationDeadline.toLocaleString('it-IT')}.`;
  }

  private courseCreationAdvanceHours(booking: Booking): number {
    return typeof booking.space === 'string' ? 2 : Number(booking.space?.courseCreationAdvanceHours ?? 2);
  }

  private bookingStartDate(booking: Booking): Date {
    const date = new Date(booking.date);
    const [hours, minutes] = booking.startTime.split(':').map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }

  private courseBookingId(course?: Course): string {
    if (!course) {
      return '';
    }

    return typeof course.booking === 'string' ? course.booking : course.booking._id;
  }

  private hasBookingsOnDate(date: Date): boolean {
    return this.calendarBookings.some((item) => this.isSameDay(item.booking.date, date));
  }

  private syncSelectedCalendarBooking(): void {
    if (!this.selectedCalendarDate) {
      this.selectedCalendarBooking = null;
      return;
    }

    const selectedItems = this.selectedDayBookings();
    if (!selectedItems.length) {
      this.selectedCalendarBooking = null;
      return;
    }

    const currentId = this.selectedCalendarBooking?.booking._id;
    this.selectedCalendarBooking = selectedItems.find((item) => item.booking._id === currentId) || selectedItems[0];
  }

  private isSameDay(first: string | Date, second: string | Date): boolean {
    const firstDate = new Date(first);
    const secondDate = new Date(second);
    return firstDate.getFullYear() === secondDate.getFullYear()
      && firstDate.getMonth() === secondDate.getMonth()
      && firstDate.getDate() === secondDate.getDate();
  }

  private normalizedPaymentStatus(payment: Payment): string {
    return String(payment.status || '').toUpperCase();
  }

  private primaryPayment(item: BookingWithPayments): Payment | undefined {
    return item.payments.find((payment) => this.normalizedPaymentStatus(payment) === 'PAID')
      || item.payments.find((payment) => this.normalizedPaymentStatus(payment) === 'PENDING')
      || item.payments[0];
  }

  private paymentMethodLabel(payment?: Payment): string {
    const method = String(payment?.provider || payment?.method || '').toLowerCase();
    const labels: Record<string, string> = {
      wallet: 'Wallet',
      manual: 'Pagamento manuale',
      stripe: 'Stripe',
      paypal: 'PayPal',
      nexi: 'Nexi',
      card: 'Carta',
      cash: 'Contanti',
    };

    if (method && labels[method]) {
      return labels[method];
    }

    return payment?.status === 'PAID' ? 'Pagamento registrato' : 'Pagamento da completare';
  }

  isPaymentMethodAllowed(item: BookingWithPayments, method: 'cash' | 'stripe' | 'paypal' | 'nexi'): boolean {
    const space = typeof item.booking.space === 'string' ? null : item.booking.space;
    const methods = space?.paymentMethods?.length ? space.paymentMethods : ['cash', 'stripe', 'paypal', 'nexi'];
    return methods.includes(method);
  }
}

import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/api.service';
import { Booking, BookingWithPayments, Course, CourseBooking, User } from '../../core/models';

@Component({
  selector: 'gestore-courses',
  imports: [NgIf, NgFor, ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent {
  private fb = inject(FormBuilder);
  courses: Course[] = [];
  paidBookings: Booking[] = [];
  selectedCourse: Course | null = null;
  subscribers: CourseBooking[] = [];
  clients: User[] = [];
  message = '';
  messageType: 'success' | 'warning' | 'delete' = 'warning';
  courseFormError = '';
  isLoading = true;
  isSubscriberFormOpen = false;
  pendingDelete: { type: 'course'; item: Course } | { type: 'subscriber'; item: CourseBooking } | null = null;

  courseForm = this.fb.group({
    id: [''],
    booking: ['', Validators.required],
    title: ['', Validators.required],
    description: [''],
    date: [null as Date | null, Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    capacity: [10, [Validators.required, Validators.min(1)]],
    enrollmentType: ['free', Validators.required],
    price: [0],
    isPublished: [true],
  });

  subscriberForm = this.fb.group({
    search: [''],
    userId: [''],
    name: [''],
    email: [''],
    phone: [''],
    taxCode: [''],
  });

  constructor(private api: ApiService) {
    this.courseForm.controls.date.disable();
    this.courseForm.controls.startTime.disable();
    this.courseForm.controls.endTime.disable();
    this.load();
  }

  load(): void {
    this.isLoading = true;
    forkJoin({
      courses: this.api.courses(),
      bookings: this.api.bookings(),
    }).subscribe({
      next: ({ courses, bookings }) => {
        this.courses = courses;
        this.paidBookings = bookings
          .filter((item) => item.payments.some((payment) => payment.status === 'PAID'))
          .map((item) => item.booking)
          .filter((booking) => new Date(booking.date) >= this.today());
        this.isLoading = false;
      },
      error: () => {
        this.messageType = 'warning';
        this.message = 'Corsi non disponibili.';
        this.isLoading = false;
      },
    });
  }

  private today(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  useBooking(booking: Booking): void {
    if (this.hasCourseForBooking(booking._id)) {
      this.courseFormError = 'Questa prenotazione ha gia un corso. Puoi modificarlo dalla sezione Corsi creati.';
      return;
    }

    if (!this.canSelectBookingForCourse(booking)) {
      this.courseFormError = this.courseCreationWindowMessage(booking);
      return;
    }

    this.courseFormError = '';
    this.courseForm.patchValue({
      id: '',
      booking: booking._id,
      title: '',
      description: '',
      date: this.toDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
      capacity: 10,
      enrollmentType: 'free',
      price: 0,
      isPublished: true,
    });
  }

  syncBookingDetails(bookingId = this.courseForm.getRawValue().booking || ''): void {
    const booking = this.findBookingForCourse(bookingId);
    if (!booking) {
      this.courseForm.patchValue({
        date: null,
        startTime: '',
        endTime: '',
      });
      return;
    }

    this.courseForm.patchValue({
      date: this.toDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  }

  editCourse(course: Course): void {
    this.courseFormError = '';
    this.selectedCourse = course;
    this.closeSubscriberForm();
    this.courseForm.patchValue({
      id: course._id,
      booking: typeof course.booking === 'string' ? course.booking : course.booking._id,
      title: course.title,
      description: course.description || '',
      date: this.toDate(course.date),
      startTime: course.startTime,
      endTime: course.endTime,
      capacity: course.capacity,
      enrollmentType: course.enrollmentType,
      price: course.price,
      isPublished: course.isPublished,
    });
    this.loadSubscribers(course);
  }

  saveCourse(): void {
    this.courseFormError = '';
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      this.courseFormError = this.courseValidationMessage();
      return;
    }

    const raw = this.courseForm.getRawValue();
    const booking = this.findBookingForCourse(raw.booking || '');
    if (!booking) {
      this.courseFormError = 'Seleziona una prenotazione pagata valida.';
      this.courseForm.controls.booking.markAsTouched();
      return;
    }

    if (!raw.id && !this.canSelectBookingForCourse(booking)) {
      this.courseFormError = this.courseCreationWindowMessage(booking);
      return;
    }

    if (raw.enrollmentType === 'paid' && Number(raw.price || 0) <= 0) {
      this.courseFormError = 'Inserisci un prezzo maggiore di zero per il corso a pagamento.';
      return;
    }

    const payload = {
      booking: raw.booking || '',
      title: raw.title || '',
      description: raw.description || '',
      date: this.formatApiDate(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
      capacity: Number(raw.capacity || 1),
      enrollmentType: raw.enrollmentType as 'paid' | 'free',
      price: raw.enrollmentType === 'paid' ? Number(raw.price || 0) : 0,
      isPublished: !!raw.isPublished,
    };

    const request = raw.id
      ? this.api.updateCourse(raw.id, payload)
      : this.api.createCourse(payload);

    request.subscribe({
      next: (course) => {
        this.messageType = 'success';
        this.message = 'Corso salvato.';
        this.courseFormError = '';
        this.selectedCourse = course;
        this.isSubscriberFormOpen = false;
        this.load();
        this.loadSubscribers(course);
      },
      error: (error) => {
        this.courseFormError = error?.error?.message || 'Corso non salvato.';
      },
    });
  }

  askDeleteCourse(course: Course): void {
    this.pendingDelete = { type: 'course', item: course };
  }

  deleteCourse(course: Course): void {
    this.api.deleteCourse(course._id).subscribe({
      next: () => {
        this.messageType = 'delete';
        this.message = 'Corso eliminato.';
        this.pendingDelete = null;
        this.selectedCourse = null;
        this.subscribers = [];
        this.closeSubscriberForm();
        this.courseForm.reset({ capacity: 10, enrollmentType: 'free', price: 0, isPublished: true });
        this.load();
      },
      error: (error) => {
        this.messageType = 'warning';
        this.message = error?.error?.message || 'Corso non eliminato.';
      },
    });
  }

  loadSubscribers(course: Course): void {
    this.api.courseBookings(course._id).subscribe({
      next: (subscribers) => {
        this.subscribers = subscribers;
      },
      error: () => {
        this.subscribers = [];
      },
    });
  }

  toggleSubscriberForm(): void {
    this.isSubscriberFormOpen = !this.isSubscriberFormOpen;
  }

  closeSubscriberForm(): void {
    this.isSubscriberFormOpen = false;
    this.resetSubscriberForm();
  }

  resetSubscriberForm(): void {
    this.subscriberForm.reset();
    this.clients = [];
  }

  searchClients(): void {
    const search = this.subscriberForm.value.search || '';
    if (search.length < 2) {
      this.clients = [];
      return;
    }

    this.api.searchClients(search).subscribe((clients) => {
      this.clients = clients;
    });
  }

  addSubscriber(): void {
    if (!this.selectedCourse) {
      this.messageType = 'warning';
      this.message = 'Seleziona o salva prima un corso.';
      return;
    }

    const raw = this.subscriberForm.getRawValue();
    const add = (userId: string) => {
      this.api.createCourseBooking(this.selectedCourse?._id || '', userId).subscribe({
        next: () => {
          this.messageType = 'success';
          this.message = 'Iscritto aggiunto.';
          this.resetSubscriberForm();
          this.loadSubscribers(this.selectedCourse as Course);
        },
        error: (error) => {
          this.messageType = 'warning';
          this.message = error?.error?.message || 'Iscritto non aggiunto.';
        },
      });
    };

    if (raw.userId) {
      add(raw.userId);
      return;
    }

    if (!raw.email || !raw.name) {
      this.messageType = 'warning';
      this.message = 'Seleziona un cliente o inserisci nome ed email.';
      return;
    }

    this.api.createClient({
      name: raw.name,
      email: raw.email,
      phone: raw.phone || undefined,
      taxCode: raw.taxCode || undefined,
      password: 'Cliente123!',
    }).subscribe({
      next: (user) => add(user._id || ''),
      error: (error) => {
        this.messageType = 'warning';
        this.message = error?.error?.message || 'Cliente non creato.';
      },
    });
  }

  askRemoveSubscriber(item: CourseBooking): void {
    this.pendingDelete = { type: 'subscriber', item };
  }

  removeSubscriber(item: CourseBooking): void {
    this.api.removeCourseBooking(item._id).subscribe({
      next: () => {
        this.messageType = 'delete';
        this.message = 'Iscritto eliminato.';
        this.pendingDelete = null;
        if (this.selectedCourse) {
          this.loadSubscribers(this.selectedCourse);
        }
      },
      error: () => {
        this.messageType = 'warning';
        this.message = 'Iscritto non eliminato.';
      },
    });
  }

  cancelDelete(): void {
    this.pendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.pendingDelete) {
      return;
    }

    if (this.pendingDelete.type === 'course') {
      this.deleteCourse(this.pendingDelete.item);
      return;
    }

    this.removeSubscriber(this.pendingDelete.item);
  }

  pendingDeleteTitle(): string {
    if (!this.pendingDelete) {
      return '';
    }

    return this.pendingDelete.type === 'course' ? 'Eliminare il corso?' : 'Eliminare l iscritto?';
  }

  pendingDeleteMessage(): string {
    if (!this.pendingDelete) {
      return '';
    }

    if (this.pendingDelete.type === 'course') {
      return `Il corso "${this.pendingDelete.item.title}" e i suoi iscritti verranno eliminati.`;
    }

    return `L iscrizione di ${this.userName(this.pendingDelete.item)} verra eliminata dal corso.`;
  }

  bookingName(booking: Booking): string {
    const space = typeof booking.space === 'string' ? '-' : booking.space?.name || '-';
    return `${space} - ${this.formatDate(booking.date)} ${booking.startTime}`;
  }

  hasCourseForBooking(bookingId: string): boolean {
    return this.courses.some((course) => this.courseBookingId(course) === bookingId);
  }

  isBookingDisabledForForm(bookingId: string): boolean {
    const booking = this.findBookingForCourse(bookingId);
    if (booking && !this.canSelectBookingForCourse(booking)) {
      return true;
    }

    const currentCourseId = this.courseForm.getRawValue().id;
    if (!currentCourseId) {
      return this.hasCourseForBooking(bookingId);
    }

    const currentCourse = this.courses.find((course) => course._id === currentCourseId);
    return this.hasCourseForBooking(bookingId) && this.courseBookingId(currentCourse) !== bookingId;
  }

  canSelectBookingForCourse(booking: Booking): boolean {
    const bookingStart = this.bookingStartDate(booking);
    const advanceHours = this.courseCreationAdvanceHours(booking);
    const creationDeadline = new Date(bookingStart.getTime() - (advanceHours * 60 * 60 * 1000));
    const now = new Date();
    return now <= creationDeadline;
  }

  courseCreationWindowMessage(booking: Booking): string {
    const advanceHours = this.courseCreationAdvanceHours(booking);
    const creationDeadline = new Date(this.bookingStartDate(booking).getTime() - (advanceHours * 60 * 60 * 1000));
    return `Puoi creare il corso solo fino a ${advanceHours} ore prima dell'inizio: entro ${creationDeadline.toLocaleString('it-IT')}.`;
  }

  courseForBooking(bookingId: string): Course | undefined {
    return this.courses.find((course) => this.courseBookingId(course) === bookingId);
  }

  private courseBookingId(course?: Course): string {
    if (!course) {
      return '';
    }

    return typeof course.booking === 'string' ? course.booking : course.booking._id;
  }

  private findBookingForCourse(bookingId: string): Booking | null {
    const booking = this.paidBookings.find((item) => item._id === bookingId);
    if (booking) {
      return booking;
    }

    if (this.selectedCourse && typeof this.selectedCourse.booking !== 'string' && this.selectedCourse.booking._id === bookingId) {
      return this.selectedCourse.booking;
    }

    return null;
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

  private courseValidationMessage(): string {
    const missing: string[] = [];
    const controls = this.courseForm.controls;

    if (controls.booking.invalid) {
      missing.push('prenotazione');
    }
    if (controls.title.invalid) {
      missing.push('titolo');
    }
    if (controls.capacity.invalid) {
      missing.push('capienza');
    }
    if (controls.enrollmentType.invalid) {
      missing.push('tipo iscrizione');
    }

    return missing.length
      ? `Compila i campi obbligatori: ${missing.join(', ')}.`
      : 'Compila correttamente i dati del corso.';
  }

  isPaidPriceInvalid(): boolean {
    const raw = this.courseForm.getRawValue();
    return raw.enrollmentType === 'paid' && Number(raw.price || 0) <= 0;
  }

  courseSpace(course: Course): string {
    const booking = typeof course.booking === 'string' ? null : course.booking;
    return typeof booking?.space === 'string' ? '-' : booking?.space?.name || '-';
  }

  userName(item: CourseBooking): string {
    return typeof item.user === 'string' ? '-' : item.user?.name || '-';
  }

  userEmail(item: CourseBooking): string {
    return typeof item.user === 'string' ? '-' : item.user?.email || '-';
  }

  paymentStatusLabel(status: CourseBooking['paymentStatus']): string {
    const labels: Record<CourseBooking['paymentStatus'], string> = {
      PENDING: 'In attesa',
      PAID: 'Pagato',
      FAILED: 'Non riuscito',
      FREE: 'Gratuito',
    };
    return labels[status] || 'In attesa';
  }

  toDate(value: string | Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  formatDate(value: string | Date): string {
    return new Date(value).toLocaleDateString('it-IT');
  }

  formatOptionalDate(value?: string | Date | null): string {
    return value ? this.formatDate(value) : '';
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  private formatApiDate(value?: Date | string | null): string {
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
}

import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/api.service';
import { AvailabilitySlot, Booking, Payment, Space } from '../../core/models';

@Component({
  selector: 'gestore-spaces',
  imports: [NgIf, NgFor, ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './spaces.component.html',
  styleUrl: './spaces.component.scss',
})
export class SpacesComponent {
  private fb = inject(FormBuilder);
  spaces: Space[] = [];
  selectedSpace: Space | null = null;
  availableSlots: AvailabilitySlot[] = [];
  message = '';
  isLoading = true;
  isSaving = false;
  isLoadingAvailability = false;
  availabilityLoaded = false;
  selectedDayIsOpen = true;
  availabilityMaxConsecutiveTimeSlots = 1;
  confirmedBooking: Booking | null = null;
  confirmedPayments: Payment[] = [];
  checkoutProvider = '';
  isSimulatingPayment = false;
  isBookingModalOpen = false;
  minDate = this.today();

  form = this.fb.group({
    name: ['Prenotazione spazio', Validators.required],
    date: [null as Date | null, Validators.required],
    rentalMode: ['time', Validators.required],
    startTime: [''],
    endTime: [''],
    workstationQuantity: [1, [Validators.required, Validators.min(1)]],
    discountCode: [''],
  });

  constructor(private api: ApiService) {
    this.load();
  }

  load(): void {
    this.api.spaces().subscribe({
      next: (spaces) => {
        this.spaces = spaces.filter((space) => space.isAvailable);
        this.isLoading = false;
      },
      error: () => {
        this.message = 'Spazi non disponibili.';
        this.isLoading = false;
      },
    });
  }

  selectSpace(space: Space): void {
    this.selectedSpace = space;
    this.availableSlots = [];
    this.confirmedBooking = null;
    this.confirmedPayments = [];
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = false;
    this.availabilityLoaded = false;
    this.selectedDayIsOpen = true;
    this.availabilityMaxConsecutiveTimeSlots = 1;
    const mode = space.rentalModes?.includes('time') ? 'time' : 'full_day';
    this.form.patchValue({
      date: this.form.value.date || this.today(),
      rentalMode: mode,
      workstationQuantity: 1,
      startTime: '',
      endTime: '',
    });
    this.loadAvailability();
  }

  selectCalendarDate(date: Date | null): void {
    if (!date) {
      return;
    }

    this.form.patchValue({
      date,
      startTime: '',
      endTime: '',
    });
    this.confirmedBooking = null;
    this.confirmedPayments = [];
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = false;
    this.availableSlots = [];
    this.availabilityLoaded = false;
    this.selectedDayIsOpen = true;
    this.availabilityMaxConsecutiveTimeSlots = 1;
    this.loadAvailability();
  }

  loadAvailability(): void {
    const date = this.formatApiDate(this.form.value.date);
    if (!this.selectedSpace || !date || !this.form.value.rentalMode) {
      return;
    }

    this.isLoadingAvailability = true;
    this.availabilityLoaded = false;
    this.selectedDayIsOpen = true;
    this.availableSlots = [];
    this.clearSlotSelection();

    this.api.availability(
      this.selectedSpace._id,
      date,
      this.form.value.rentalMode,
      Number(this.form.value.workstationQuantity || 1),
    ).subscribe({
      next: (availability) => {
        this.availableSlots = availability.slots;
        this.selectedDayIsOpen = availability.isOpen;
        this.availabilityMaxConsecutiveTimeSlots = Math.max(Number(availability.maxConsecutiveTimeSlots || 1), 1);
        this.availabilityLoaded = true;
        this.isLoadingAvailability = false;
        if (availability.slots.length === 1 && this.form.value.rentalMode === 'full_day') {
          this.pickSlot(availability.slots[0]);
        }
      },
      error: () => {
        this.availableSlots = [];
        this.selectedDayIsOpen = false;
        this.availabilityLoaded = true;
        this.isLoadingAvailability = false;
        this.message = 'Disponibilita non caricata.';
      },
    });
  }

  pickSlot(slot: AvailabilitySlot): void {
    if (!slot.available) {
      return;
    }

    if (this.isMultiSlotSelection()) {
      this.pickConsecutiveSlot(slot);
      return;
    }

    this.form.patchValue({
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    this.confirmedBooking = null;
    this.confirmedPayments = [];
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = true;
  }

  confirmSelectedTimeSlots(): void {
    if (!this.canConfirmSelectedSlots()) {
      this.message = 'Seleziona una o piu fasce orarie consecutive disponibili.';
      return;
    }

    this.confirmedBooking = null;
    this.confirmedPayments = [];
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = true;
  }

  resetSelectedSlots(): void {
    this.clearSlotSelection();
    this.message = '';
  }

  closeBookingModal(): void {
    if (this.isSaving || this.checkoutProvider || this.isSimulatingPayment) {
      return;
    }

    this.isBookingModalOpen = false;
  }

  createBooking(): void {
    if (!this.selectedSpace || this.form.invalid || !this.form.value.startTime || !this.form.value.endTime) {
      this.message = 'Seleziona spazio, data e fascia disponibile.';
      return;
    }

    this.isSaving = true;
    this.message = '';
    const payload = {
      name: this.form.value.name,
      spaceId: this.selectedSpace._id,
      date: this.formatApiDate(this.form.value.date),
      startTime: this.form.value.startTime,
      endTime: this.form.value.endTime,
      rentalMode: this.form.value.rentalMode,
      rentalUnit: this.selectedSpace.rentalUnit,
      workstationQuantity: Number(this.form.value.workstationQuantity || 1),
      discountCode: this.form.value.discountCode || undefined,
    };

    this.api.createBooking(payload).subscribe({
      next: (booking) => {
        this.confirmedBooking = booking;
        this.loadConfirmedPayments(booking._id);
        this.message = booking.status === 'confirmed'
          ? 'Prenotazione confermata e pagata con il wallet.'
          : 'Prenotazione confermata. Ora puoi procedere con il pagamento residuo.';
        this.isSaving = false;
      },
      error: (error) => {
        this.message = error?.error?.message || 'Prenotazione non creata.';
        this.isSaving = false;
      },
    });
  }

  startCheckout(provider: 'stripe' | 'paypal' | 'nexi'): void {
    if (!this.confirmedBooking || this.checkoutProvider || this.isSimulatingPayment || !this.isPaymentMethodAllowed(provider)) {
      return;
    }

    this.checkoutProvider = provider;
    this.message = '';
    this.api.createCheckout(this.confirmedBooking._id, provider).subscribe({
      next: (checkout) => {
        window.location.href = checkout.checkoutUrl;
      },
      error: (error) => {
        this.message = error?.error?.message || `${provider} non disponibile o non configurato.`;
        this.checkoutProvider = '';
      },
    });
  }

  payCash(): void {
    if (!this.confirmedBooking || this.checkoutProvider || this.isSimulatingPayment || !this.isPaymentMethodAllowed('cash')) {
      return;
    }

    this.isSimulatingPayment = true;
    this.message = '';
    this.api.markBookingPaid(this.confirmedBooking._id, this.confirmedExternalAmount(), 'cash').subscribe({
      next: () => {
        this.message = 'Pagamento in contanti registrato correttamente. La prenotazione risulta pagata.';
        this.isSimulatingPayment = false;
        this.isBookingModalOpen = false;
      },
      error: (error) => {
        this.message = error?.error?.message || 'Pagamento in contanti non registrato.';
        this.isSimulatingPayment = false;
      },
    });
  }

  isPaymentMethodAllowed(method: 'cash' | 'stripe' | 'paypal' | 'nexi'): boolean {
    const methods = this.selectedSpace?.paymentMethods?.length
      ? this.selectedSpace.paymentMethods
      : ['cash', 'stripe', 'paypal', 'nexi'];
    return methods.includes(method);
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  selectedSlotAmount(): number {
    const selectedSlots = this.selectedSlots();
    if (selectedSlots.length) {
      return selectedSlots.reduce((total, slot) => total + (slot.amount || 0), 0);
    }

    return 0;
  }

  confirmedTotalAmount(): number {
    const payment = this.confirmedPayment();
    return payment?.totalAmount || this.selectedSlotAmount();
  }

  confirmedWalletAmount(): number {
    return this.confirmedPayment()?.walletAmount || 0;
  }

  confirmedExternalAmount(): number {
    const payment = this.confirmedPayment();
    return payment?.externalAmount || payment?.amount || this.selectedSlotAmount();
  }

  hasExternalAmount(): boolean {
    return this.confirmedExternalAmount() > 0;
  }

  formatDisplayDate(value?: Date | string | null): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleDateString('it-IT');
  }

  isMultiSlotSelection(): boolean {
    return this.form.value.rentalMode === 'time' && this.maxConsecutiveTimeSlots() > 1;
  }

  maxConsecutiveTimeSlots(): number {
    return Math.max(Number(this.availabilityMaxConsecutiveTimeSlots || 1), 1);
  }

  isSlotSelected(slot: AvailabilitySlot): boolean {
    return this.selectedSlots().some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
  }

  canConfirmSelectedSlots(): boolean {
    return !!this.form.value.startTime && !!this.form.value.endTime && this.selectedSlots().length > 0;
  }

  selectedSlotsLabel(): string {
    const slots = this.selectedSlots();
    if (!slots.length) {
      return 'Nessuna fascia selezionata';
    }

    return `${slots[0].startTime} - ${slots[slots.length - 1].endTime}`;
  }

  private pickConsecutiveSlot(slot: AvailabilitySlot): void {
    const clickedIndex = this.availableSlots.findIndex((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
    if (clickedIndex < 0) {
      return;
    }

    const currentSlots = this.selectedSlots();
    if (!currentSlots.length) {
      this.setSelectedSlots(clickedIndex, clickedIndex);
      return;
    }

    if (currentSlots.length === 1 && currentSlots[0].startTime === slot.startTime && currentSlots[0].endTime === slot.endTime) {
      this.clearSlotSelection();
      return;
    }

    const startIndex = this.availableSlots.findIndex((item) => item.startTime === currentSlots[0].startTime);
    const from = Math.min(startIndex, clickedIndex);
    const to = Math.max(startIndex, clickedIndex);
    const range = this.availableSlots.slice(from, to + 1);
    if (range.length > this.maxConsecutiveTimeSlots()) {
      this.message = `Puoi selezionare al massimo ${this.maxConsecutiveTimeSlots()} fasce orarie consecutive.`;
      return;
    }

    const isConsecutive = range.every((item, index) =>
      item.available && (index === 0 || range[index - 1].endTime === item.startTime)
    );

    if (!isConsecutive) {
      this.message = 'Puoi selezionare solo fasce orarie consecutive disponibili.';
      this.setSelectedSlots(clickedIndex, clickedIndex);
      return;
    }

    this.message = '';
    this.setSelectedSlots(from, to);
  }

  private selectedSlots(): AvailabilitySlot[] {
    if (!this.form.value.startTime || !this.form.value.endTime) {
      return [];
    }

    const startIndex = this.availableSlots.findIndex((item) => item.startTime === this.form.value.startTime);
    const endIndex = this.availableSlots.findIndex((item) => item.endTime === this.form.value.endTime);
    if (startIndex < 0 || endIndex < startIndex) {
      return [];
    }

    return this.availableSlots.slice(startIndex, endIndex + 1).filter((item) => item.available);
  }

  private setSelectedSlots(from: number, to: number): void {
    const first = this.availableSlots[from];
    const last = this.availableSlots[to];
    if (!first || !last) {
      this.clearSlotSelection();
      return;
    }

    this.form.patchValue({
      startTime: first.startTime,
      endTime: last.endTime,
    });
    this.confirmedBooking = null;
    this.confirmedPayments = [];
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = false;
  }

  private clearSlotSelection(): void {
    this.form.patchValue({
      startTime: '',
      endTime: '',
    });
    this.confirmedBooking = null;
    this.confirmedPayments = [];
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = false;
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

  private today(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private loadConfirmedPayments(bookingId: string): void {
    this.api.bookingPayments(bookingId).subscribe({
      next: (payments) => {
        this.confirmedPayments = payments;
      },
      error: () => {
        this.confirmedPayments = [];
      },
    });
  }

  private confirmedPayment(): Payment | undefined {
    return this.confirmedPayments.find((payment) => payment.status === 'PAID')
      || this.confirmedPayments.find((payment) => payment.status === 'PENDING')
      || this.confirmedPayments[0];
  }
}

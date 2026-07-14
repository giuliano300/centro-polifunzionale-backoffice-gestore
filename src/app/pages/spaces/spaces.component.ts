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
import { AvailabilitySlot, Booking, Space } from '../../core/models';

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
  confirmedBooking: Booking | null = null;
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
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = false;
    this.availabilityLoaded = false;
    this.selectedDayIsOpen = true;
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
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = false;
    this.availableSlots = [];
    this.availabilityLoaded = false;
    this.selectedDayIsOpen = true;
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

    this.api.availability(
      this.selectedSpace._id,
      date,
      this.form.value.rentalMode,
      Number(this.form.value.workstationQuantity || 1),
    ).subscribe({
      next: (availability) => {
        this.availableSlots = availability.slots;
        this.selectedDayIsOpen = availability.isOpen;
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

    this.form.patchValue({
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    this.confirmedBooking = null;
    this.checkoutProvider = '';
    this.isSimulatingPayment = false;
    this.isBookingModalOpen = true;
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
    };

    this.api.createBooking(payload).subscribe({
      next: (booking) => {
        this.confirmedBooking = booking;
        this.message = 'Prenotazione confermata. Ora puoi procedere con il pagamento.';
        this.isSaving = false;
      },
      error: (error) => {
        this.message = error?.error?.message || 'Prenotazione non creata.';
        this.isSaving = false;
      },
    });
  }

  startCheckout(provider: 'stripe' | 'paypal' | 'nexi'): void {
    if (!this.confirmedBooking || this.checkoutProvider || this.isSimulatingPayment) {
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

  simulatePayment(): void {
    if (!this.confirmedBooking || this.checkoutProvider || this.isSimulatingPayment) {
      return;
    }

    this.isSimulatingPayment = true;
    this.message = '';
    this.api.markBookingPaid(this.confirmedBooking._id, this.selectedSlotAmount()).subscribe({
      next: () => {
        this.message = 'Pagamento simulato correttamente. La prenotazione risulta pagata.';
        this.isSimulatingPayment = false;
        this.isBookingModalOpen = false;
      },
      error: (error) => {
        this.message = error?.error?.message || 'Pagamento simulato non riuscito.';
        this.isSimulatingPayment = false;
      },
    });
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  selectedSlotAmount(): number {
    const slot = this.availableSlots.find((item) =>
      item.startTime === this.form.value.startTime && item.endTime === this.form.value.endTime
    );
    return slot?.amount || 0;
  }

  formatDisplayDate(value?: Date | string | null): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleDateString('it-IT');
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
}

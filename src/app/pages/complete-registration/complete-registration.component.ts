import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'gestore-complete-registration',
  imports: [NgIf, NgFor, RouterLink, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './complete-registration.component.html',
  styleUrl: './complete-registration.component.scss',
})
export class CompleteRegistrationComponent {
  private fb = inject(FormBuilder);
  token = '';
  isSaving = false;
  isLoadingInvite = false;
  isSendingOtp = false;
  completed = false;
  message = '';
  devPhoneOtp = '';
  otpPhone = '';

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^3[0-9]{8,9}$/)]],
    taxCode: ['', [Validators.required, this.taxCodeValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phoneOtp: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
    acceptedDataProcessing: [false, Validators.requiredTrue],
  });

  constructor(private route: ActivatedRoute, private auth: AuthService) {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.message = 'Link registrazione non valido.';
      return;
    }

    this.loadInviteDetails();
  }

  loadInviteDetails(): void {
    this.isLoadingInvite = true;
    this.message = '';
    this.auth.getClientInviteDetails(this.token).subscribe({
      next: (invite) => {
        this.form.patchValue({
          name: invite.name || '',
          email: invite.email || '',
          phone: invite.phone || '',
          taxCode: invite.taxCode || '',
        });
        this.form.controls.email.disable();
        this.isLoadingInvite = false;
      },
      error: (error) => {
        this.message = error?.error?.message || 'Link registrazione scaduto o non valido.';
        this.isLoadingInvite = false;
      },
    });
  }

  requestPhoneOtp(): void {
    if (!this.token || this.form.controls.phone.invalid || this.isSendingOtp) {
      this.form.controls.phone.markAsTouched();
      return;
    }

    this.isSendingOtp = true;
    this.message = '';
    this.devPhoneOtp = '';
    const phone = this.form.controls.phone.value || '';
    this.auth.requestClientInvitePhoneOtp(this.token, phone).subscribe({
      next: (response) => {
        this.otpPhone = response.phone;
        this.devPhoneOtp = response.devPhoneOtp || '';
        this.message = `OTP inviato al cellulare ${response.phone}. Valido ${response.expiresInMinutes} minuti.`;
        this.isSendingOtp = false;
      },
      error: (error) => {
        this.message = error?.error?.message || 'OTP cellulare non inviato.';
        this.isSendingOtp = false;
      },
    });
  }

  validationErrors(): string[] {
    if (!this.form.touched) {
      return [];
    }

    const errors: string[] = [];
    const controls = this.form.controls;

    if (controls.name.touched && controls.name.hasError('required')) {
      errors.push('Nome e cognome obbligatori.');
    }
    if (controls.phone.touched && controls.phone.invalid) {
      errors.push('Cellulare obbligatorio: inserisci 9 o 10 cifre senza prefisso.');
    }
    if (controls.phoneOtp.touched && controls.phoneOtp.invalid) {
      errors.push('Inserisci il codice OTP di 6 cifre.');
    }
    if (controls.taxCode.touched && controls.taxCode.hasError('required')) {
      errors.push('Codice fiscale obbligatorio.');
    } else if (controls.taxCode.touched && controls.taxCode.hasError('taxCode')) {
      errors.push('Codice fiscale non valido.');
    }
    if (controls.password.touched && controls.password.invalid) {
      errors.push('Password obbligatoria di almeno 6 caratteri.');
    }
    if (controls.acceptedDataProcessing.touched && controls.acceptedDataProcessing.invalid) {
      errors.push('Devi accettare il trattamento dei dati.');
    }

    return errors;
  }

  complete(): void {
    if (!this.token || this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.message = '';
    const raw = this.form.getRawValue();
    this.auth.completeClientRegistration({
      token: this.token,
      name: raw.name || '',
      email: raw.email || '',
      phone: raw.phone || undefined,
      taxCode: raw.taxCode || undefined,
      password: raw.password || '',
      acceptedDataProcessing: raw.acceptedDataProcessing === true,
      phoneOtp: raw.phoneOtp || undefined,
    }).subscribe({
      next: () => {
        this.completed = true;
        this.isSaving = false;
        this.message = 'Registrazione completata. Il premio e stato accreditato nel wallet.';
      },
      error: (error) => {
        this.message = error?.error?.message || 'Registrazione non completata.';
        this.isSaving = false;
      },
    });
  }

  private taxCodeValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '').trim().toUpperCase();
    if (!value) {
      return null;
    }

    if (!/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(value)) {
      return { taxCode: true };
    }

    const oddMap: Record<string, number> = {
      '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
      A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
      N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
    };
    const evenMap: Record<string, number> = {
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
      N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
    };
    const sum = value.slice(0, 15).split('').reduce((total, char, index) => {
      return total + ((index + 1) % 2 === 1 ? oddMap[char] : evenMap[char]);
    }, 0);

    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[sum % 26] === value[15] ? null : { taxCode: true };
  }
}

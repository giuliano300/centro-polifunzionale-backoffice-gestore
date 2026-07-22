import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../core/api.service';
import { User } from '../../core/models';

@Component({
  selector: 'gestore-profile',
  imports: [NgIf, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);

  user: User | null = null;
  isLoading = true;
  isSaving = false;
  isSendingOtp = false;
  hidePassword = true;
  message = '';
  errorMessage = '';
  originalPhone = '';
  devPhoneOtp = '';

  form = this.fb.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }],
    phone: ['', [Validators.required, Validators.pattern(/^3[0-9]{8,9}$/)]],
    phoneOtp: ['', Validators.pattern(/^[0-9]{6}$/)],
    taxCode: [''],
    password: [''],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.api.profile().subscribe({
      next: (user) => {
        this.user = user;
        this.form.patchValue({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          phoneOtp: '',
          taxCode: user.taxCode || '',
          password: '',
        });
        this.originalPhone = user.phone || '';
        this.devPhoneOtp = '';
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Dati personali non disponibili.';
        this.isLoading = false;
      },
    });
  }

  phoneChanged(): boolean {
    return this.normalizePhone(this.form.controls.phone.value || '') !== this.normalizePhone(this.originalPhone);
  }

  requestPhoneOtp(): void {
    this.message = '';
    this.errorMessage = '';
    this.devPhoneOtp = '';

    if (!this.phoneChanged()) {
      this.errorMessage = 'Modifica il cellulare prima di richiedere l OTP.';
      return;
    }
    if (this.form.controls.phone.invalid || this.isSendingOtp) {
      this.form.controls.phone.markAsTouched();
      this.errorMessage = 'Cellulare non valido: inserisci 9 o 10 cifre senza prefisso.';
      return;
    }

    this.isSendingOtp = true;
    this.api.requestProfilePhoneOtp(this.form.controls.phone.value || '').subscribe({
      next: (response) => {
        this.devPhoneOtp = response.devPhoneOtp || '';
        this.message = `OTP inviato al cellulare ${response.phone}. Valido ${response.expiresInMinutes} minuti.`;
        this.isSendingOtp = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'OTP cellulare non inviato.';
        this.isSendingOtp = false;
      },
    });
  }

  save(): void {
    this.message = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Compila i campi obbligatori.';
      return;
    }

    const value = this.form.getRawValue();
    if (this.phoneChanged() && !/^[0-9]{6}$/.test(value.phoneOtp || '')) {
      this.form.controls.phoneOtp.markAsTouched();
      this.errorMessage = 'Verifica il nuovo cellulare con OTP prima di salvare.';
      return;
    }

    const payload = {
      name: value.name || '',
      phone: value.phone || '',
      phoneOtp: value.phoneOtp || undefined,
      taxCode: value.taxCode || '',
      ...(value.password ? { password: value.password } : {}),
    };

    this.isSaving = true;
    this.api.updateProfile(payload).subscribe({
      next: (user) => {
        this.user = user;
        this.originalPhone = user.phone || '';
        this.devPhoneOtp = '';
        this.form.patchValue({ password: '', phoneOtp: '' });
        this.message = 'Dati personali aggiornati.';
        this.isSaving = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Salvataggio non riuscito.';
        this.isSaving = false;
      },
    });
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[\s./()-]/g, '');
  }
}

import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';
import { NotificationsService } from '../../core/notifications.service';

@Component({
  selector: 'gestore-login',
  imports: [NgIf, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  isLoading = false;
  isRecovery = false;
  isRegistration = false;
  resetToken = '';
  registrationOtpRequested = false;
  registrationEmail = '';
  registrationPhone = '';
  devEmailOtp = '';
  devPhoneOtp = '';
  devResetUrl = '';
  hideLoginPassword = true;
  hideResetPassword = true;
  hideResetConfirmPassword = true;
  hideRegistrationPassword = true;
  hideRegistrationConfirmPassword = true;
  errorMessage = '';
  successMessage = '';
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  recoveryForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  resetTokenForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  registrationForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, this.italianMobilePhoneValidator]],
    taxCode: ['', [Validators.required, this.taxCodeValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  otpForm = this.fb.group({
    emailOtp: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
    phoneOtp: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
  });

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute, private notifications: NotificationsService) {
    this.route.queryParamMap.subscribe((params) => {
      const token = params.get('resetToken') || '';
      if (!token) {
        return;
      }

      this.resetToken = token;
      this.isRecovery = true;
      this.isRegistration = false;
      this.errorMessage = '';
      this.successMessage = '';
    });
  }

  submit(): void {
    if (this.form.invalid || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const { email, password } = this.form.getRawValue();
    this.auth.login(email || '', password || '').subscribe({
      next: () => {
        if (!this.auth.isManager()) {
          this.auth.logout();
          this.errorMessage = 'Accesso consentito solo ai gestori.';
          this.isLoading = false;
          return;
        }

        this.notifications.connect();
        this.router.navigate(['/']);
      },
      error: (error) => {
        const message = error?.error?.message || '';
        this.errorMessage = message.toLowerCase().includes('utente disattivato')
          ? "Utente disattivato, contattare l'amministrazione."
          : 'Username o password errati.';
        this.isLoading = false;
      },
    });
  }

  toggleRecovery(): void {
    this.isRecovery = !this.isRecovery;
    this.isRegistration = false;
    if (!this.isRecovery) {
      this.resetToken = '';
      this.devResetUrl = '';
      this.router.navigate(['/login']);
    }
    this.errorMessage = '';
    this.successMessage = '';
  }

  toggleRegistration(): void {
    this.isRegistration = !this.isRegistration;
    this.isRecovery = false;
    this.resetToken = '';
    this.devResetUrl = '';
    this.registrationOtpRequested = false;
    this.registrationEmail = '';
    this.registrationPhone = '';
    this.devEmailOtp = '';
    this.devPhoneOtp = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  resetPassword(): void {
    if (this.recoveryForm.invalid || this.isLoading) {
      this.recoveryForm.markAllAsTouched();
      return;
    }

    const { email } = this.recoveryForm.getRawValue();
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.devResetUrl = '';
    this.auth.requestManagerPasswordResetLink(email || '').subscribe({
      next: (response) => {
        this.devResetUrl = response.devResetUrl || '';
        this.successMessage = `Link di recupero inviato a ${response.email}. Valido ${response.expiresInMinutes} minuti.`;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Invio link non riuscito.';
        this.isLoading = false;
      },
    });
  }

  confirmResetPassword(): void {
    if (this.resetTokenForm.invalid || this.isLoading) {
      this.resetTokenForm.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.resetTokenForm.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage = 'Le password non coincidono.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.auth.confirmManagerPasswordReset(this.resetToken, password || '').subscribe({
      next: (response) => {
        this.successMessage = 'Password aggiornata. Ora puoi effettuare il login.';
        this.form.patchValue({ email: response.email, password });
        this.resetTokenForm.reset();
        this.isRecovery = false;
        this.resetToken = '';
        this.isLoading = false;
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Aggiornamento password non riuscito.';
        this.isLoading = false;
      },
    });
  }

  requestRegistrationOtp(): void {
    if (this.registrationForm.invalid || this.isLoading) {
      this.registrationForm.markAllAsTouched();
      return;
    }

    const { name, email, phone, taxCode, password, confirmPassword } = this.registrationForm.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage = 'Le password non coincidono.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.devEmailOtp = '';
    this.devPhoneOtp = '';
    this.auth.requestManagerRegistrationOtp({
      name: name || '',
      email: email || '',
      phone: phone || '',
      taxCode: taxCode || '',
      password: password || '',
    }).subscribe({
      next: (response) => {
        this.registrationOtpRequested = true;
        this.registrationEmail = response.email;
        this.registrationPhone = response.phone;
        this.devEmailOtp = response.devEmailOtp || '';
        this.devPhoneOtp = response.devPhoneOtp || '';
        this.successMessage = `OTP inviati a ${response.email} e ${response.phone}. Validi ${response.expiresInMinutes} minuti.`;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Registrazione non avviata.';
        this.isLoading = false;
      },
    });
  }

  confirmRegistrationOtp(): void {
    if (this.otpForm.invalid || this.isLoading) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.auth.confirmManagerRegistrationOtp(
      this.registrationEmail,
      this.otpForm.value.emailOtp || '',
      this.otpForm.value.phoneOtp || '',
    ).subscribe({
      next: () => {
        const { email, password } = this.registrationForm.getRawValue();
        this.successMessage = 'Registrazione completata. Ora puoi effettuare il login.';
        this.form.patchValue({ email, password });
        this.registrationForm.reset();
        this.otpForm.reset();
        this.isRegistration = false;
        this.registrationOtpRequested = false;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'OTP non confermato.';
        this.isLoading = false;
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

  private italianMobilePhoneValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '').replace(/[\s./()-]/g, '');
    if (!value) {
      return null;
    }

    return /^3[0-9]{8,9}$/.test(value) ? null : { italianMobilePhone: true };
  }
}

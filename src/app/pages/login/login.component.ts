import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
  errorMessage = '';
  successMessage = '';
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  recoveryForm = this.fb.group({
    email: ['mario.rossi1@gmail.com', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(private auth: AuthService, private router: Router, private notifications: NotificationsService) {}

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
      error: () => {
        this.errorMessage = 'Username o password errati.';
        this.isLoading = false;
      },
    });
  }

  toggleRecovery(): void {
    this.isRecovery = !this.isRecovery;
    this.errorMessage = '';
    this.successMessage = '';
  }

  resetPassword(): void {
    if (this.recoveryForm.invalid || this.isLoading) {
      return;
    }

    const { email, password, confirmPassword } = this.recoveryForm.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage = 'Le password non coincidono.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.auth.resetManagerPassword(email || '', password || '').subscribe({
      next: () => {
        this.successMessage = 'Password aggiornata. Ora puoi effettuare il login.';
        this.form.patchValue({ email, password });
        this.isRecovery = false;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Recupero password non riuscito.';
        this.isLoading = false;
      },
    });
  }
}

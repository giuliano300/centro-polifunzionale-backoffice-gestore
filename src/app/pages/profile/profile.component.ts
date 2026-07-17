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
  message = '';
  errorMessage = '';

  form = this.fb.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }],
    phone: [''],
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
          taxCode: user.taxCode || '',
          password: '',
        });
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Dati personali non disponibili.';
        this.isLoading = false;
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
    const payload = {
      name: value.name || '',
      phone: value.phone || '',
      taxCode: value.taxCode || '',
      ...(value.password ? { password: value.password } : {}),
    };

    this.isSaving = true;
    this.api.updateProfile(payload).subscribe({
      next: (user) => {
        this.user = user;
        this.form.patchValue({ password: '' });
        this.message = 'Dati personali aggiornati.';
        this.isSaving = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Salvataggio non riuscito.';
        this.isSaving = false;
      },
    });
  }
}

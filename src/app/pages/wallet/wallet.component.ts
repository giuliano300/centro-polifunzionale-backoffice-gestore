import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { WalletMovement, WalletSummary } from '../../core/models';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'gestore-wallet',
  imports: [NgIf, NgFor, MatCardModule],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.scss',
})
export class WalletComponent {
  wallet: WalletSummary | null = null;
  isLoading = true;
  message = '';

  constructor(private api: ApiService) {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.api.wallet().subscribe({
      next: (wallet) => {
        this.wallet = wallet;
        this.isLoading = false;
      },
      error: () => {
        this.message = 'Portafogli non disponibile.';
        this.isLoading = false;
      },
    });
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  formatDate(value?: string | Date): string {
    return value ? new Date(value).toLocaleDateString('it-IT') : '-';
  }

  movementLabel(item: WalletMovement): string {
    const labels: Record<WalletMovement['reason'], string> = {
      cancellation_refund: 'Credito da annullamento',
      booking_payment: 'Utilizzo su prenotazione',
      manual: 'Movimento manuale',
    };
    return labels[item.reason] || 'Movimento';
  }

  movementSign(item: WalletMovement): string {
    return item.type === 'credit' ? '+' : '-';
  }
}

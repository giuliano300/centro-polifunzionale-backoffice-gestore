import { Component } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/auth.service';
import { ApiService } from './core/api.service';
import { User } from './core/models';
import { NotificationsService } from './core/notifications.service';

@Component({
  selector: 'gestore-root',
  imports: [NgIf, NgFor, AsyncPipe, RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatTooltipModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  isNotificationsOpen = false;
  isSidebarCollapsed = false;
  manager: User | null = null;
  currentYear = new Date().getFullYear();

  constructor(public auth: AuthService, public notifications: NotificationsService, private api: ApiService, private router: Router) {
    if (this.auth.isAuthenticated()) {
      this.notifications.connect();
      this.loadManager();
    }

    this.auth.loginCompleted$.subscribe(() => {
      this.loadManager();
    });
  }

  get managerName(): string {
    const payload = this.auth.payload();
    return this.manager?.name || payload?.name || payload?.email || 'Gestore';
  }

  private loadManager(): void {
    this.api.profile().subscribe({
      next: (user) => {
        this.manager = user;
      },
      error: (error) => {
        this.manager = null;
        if (error?.status === 401) {
          this.logout();
        }
      },
    });
  }

  logout(): void {
    this.notifications.disconnect();
    this.auth.logout();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleNotifications(): void {
    this.isNotificationsOpen = !this.isNotificationsOpen;
    if (this.isNotificationsOpen) {
      this.notifications.markAllRead();
    }
  }

  openNotification(link?: string): void {
    if (!link) {
      return;
    }
    this.isNotificationsOpen = false;
    this.router.navigateByUrl(link);
  }
}

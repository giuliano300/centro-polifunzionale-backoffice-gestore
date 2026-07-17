import { Component } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/auth.service';
import { NotificationsService } from './core/notifications.service';

@Component({
  selector: 'gestore-root',
  imports: [NgIf, NgFor, AsyncPipe, RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatTooltipModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  isNotificationsOpen = false;

  constructor(public auth: AuthService, public notifications: NotificationsService, private router: Router) {
    if (this.auth.isAuthenticated()) {
      this.notifications.connect();
    }
  }

  logout(): void {
    this.notifications.disconnect();
    this.auth.logout();
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

import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SpacesComponent } from './pages/spaces/spaces.component';
import { BookingsComponent } from './pages/bookings/bookings.component';
import { CoursesComponent } from './pages/courses/courses.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', canActivate: [authGuard], component: DashboardComponent },
  { path: 'spaces', canActivate: [authGuard], component: SpacesComponent },
  { path: 'bookings', canActivate: [authGuard], component: BookingsComponent },
  { path: 'courses', canActivate: [authGuard], component: CoursesComponent },
  { path: '**', redirectTo: '' },
];

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  Booking,
  BookingAvailability,
  BookingWithPayments,
  Course,
  CourseBooking,
  Payment,
  Space,
  User,
} from './models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.auth.token()}`,
      }),
    };
  }

  spaces() {
    return this.http.get<Space[]>(`${this.apiUrl}spaces`, this.headers());
  }

  bookings(filters: Record<string, string> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<BookingWithPayments[]>(`${this.apiUrl}bookings`, { ...this.headers(), params });
  }

  availability(spaceId: string, date: string, rentalMode: string, workstationQuantity = 1) {
    const params = new HttpParams()
      .set('spaceId', spaceId)
      .set('date', date)
      .set('rentalMode', rentalMode)
      .set('workstationQuantity', workstationQuantity);
    return this.http.get<BookingAvailability>(`${this.apiUrl}bookings/availability`, { ...this.headers(), params });
  }

  createBooking(payload: Record<string, unknown>) {
    return this.http.post<Booking>(`${this.apiUrl}bookings`, payload, this.headers());
  }

  payments(filters: Record<string, string> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<Payment[]>(`${this.apiUrl}payments`, { ...this.headers(), params });
  }

  markBookingPaid(bookingId: string, amount?: number) {
    const payload: { amount?: number; method: string; transactionId: string } = {
      method: 'manual',
      transactionId: `MANUAL-${Date.now()}`,
    };

    if (amount && amount > 0) {
      payload.amount = amount;
    }

    return this.http.post<Payment>(`${this.apiUrl}payments/booking/${bookingId}/confirm`, payload, this.headers());
  }

  createCheckout(bookingId: string, provider: 'stripe' | 'paypal' | 'nexi') {
    const origin = window.location.origin;
    return this.http.post<{ provider: string; paymentId: string; checkoutUrl: string; transactionId?: string }>(
      `${this.apiUrl}payments/booking/${bookingId}/checkout`,
      {
        provider,
        successUrl: `${origin}/bookings?payment=success`,
        cancelUrl: `${origin}/bookings?payment=cancel`,
      },
      this.headers(),
    );
  }

  courses(filters: Record<string, string> = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return this.http.get<Course[]>(`${this.apiUrl}courses`, { ...this.headers(), params });
  }

  createCourse(payload: Partial<Course>) {
    return this.http.post<Course>(`${this.apiUrl}courses`, payload, this.headers());
  }

  updateCourse(id: string, payload: Partial<Course>) {
    return this.http.patch<Course>(`${this.apiUrl}courses/${id}`, payload, this.headers());
  }

  deleteCourse(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}courses/${id}`, this.headers());
  }

  courseBookings(courseId?: string) {
    const params = courseId ? new HttpParams().set('courseId', courseId) : undefined;
    return this.http.get<CourseBooking[]>(`${this.apiUrl}course-bookings`, { ...this.headers(), params });
  }

  createCourseBooking(courseId: string, userId: string) {
    return this.http.post<CourseBooking>(`${this.apiUrl}course-bookings`, { courseId, userId }, this.headers());
  }

  removeCourseBooking(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}course-bookings/${id}`, this.headers());
  }

  searchClients(search: string) {
    const params = new HttpParams()
      .set('role', 'cliente')
      .set('excludeRole', 'admin')
      .set('limit', '20')
      .set('search', search);
    return this.http.get<User[]>(`${this.apiUrl}users`, { ...this.headers(), params });
  }

  createClient(payload: Partial<User> & { password: string }) {
    return this.http.post<User>(`${this.apiUrl}users`, { ...payload, role: 'cliente' }, this.headers());
  }
}

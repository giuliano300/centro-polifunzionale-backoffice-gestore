export interface JwtPayload {
  sub?: string;
  userId?: string;
  email?: string;
  role?: 'admin' | 'gestore' | 'cliente';
  exp?: number;
}

export interface LoginResponse {
  access_token: string;
}

export interface User {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  taxCode?: string;
  role?: string;
}

export interface SpaceOpeningSlot {
  day: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface Space {
  _id: string;
  name: string;
  description?: string;
  hourlyRate?: number;
  dailyRate?: number;
  rentalUnit: 'whole_room' | 'workstation';
  rentalModes: Array<'time' | 'full_day'>;
  timeSlotMinutes?: number;
  workstationCount?: number;
  openingHours?: SpaceOpeningSlot[];
  isAvailable: boolean;
}

export interface Booking {
  _id: string;
  name: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  rentalUnit: 'whole_room' | 'workstation';
  rentalMode: 'time' | 'full_day';
  workstationQuantity?: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  user?: string | User;
  space?: string | Space;
}

export interface Payment {
  _id?: string;
  bookingId: string | Booking;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
  method?: string;
  transactionId?: string;
  provider?: 'manual' | 'stripe' | 'paypal' | 'nexi';
  checkoutUrl?: string;
}

export interface BookingWithPayments {
  booking: Booking;
  payments: Payment[];
}

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  amount: number;
  available: boolean;
}

export interface BookingAvailability {
  spaceId: string;
  date: string;
  rentalMode: 'time' | 'full_day';
  isOpen: boolean;
  slots: AvailabilitySlot[];
}

export interface Course {
  _id: string;
  title: string;
  description?: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  booking: string | Booking;
  capacity: number;
  enrollmentType: 'paid' | 'free';
  price: number;
  isPublished: boolean;
}

export interface CourseBooking {
  _id: string;
  user: string | User;
  course: string | Course;
  status: string;
  enrollmentType: 'paid' | 'free';
  amount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'FREE';
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getBookingById, cancelBooking } from '../../services/bookingService';
import { useAuth } from '../../contexts/AuthContext';
import { formatVND } from '../../utils/currency';
import '../../assets/styles/BookingDetail.scss';

const BookingDetail = () => {
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancelling, setCancelling] = useState(false);
    
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        loadBooking();
    }, [id]);

    const loadBooking = async () => {
        try {
            setLoading(true);
            const response = await getBookingById(id);
            
            if (response.errCode === 0) {
                setBooking(response.booking);
            } else {
                setError(response.message || 'Booking not found');
            }
        } catch (error) {
            console.error('Error loading booking:', error);
            setError('Failed to load booking details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelBooking = async () => {
        if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
            return;
        }

        try {
            setCancelling(true);
            const response = await cancelBooking(id);
            
            if (response.errCode === 0) {
                setBooking(prev => ({ ...prev, orderStatus: 'Cancelled' }));
                alert('Booking cancelled successfully!');
            } else {
                alert(response.message || 'Failed to cancel booking');
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            alert('Failed to cancel booking. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending':
                return 'status-pending';
            case 'Confirmed':
                return 'status-confirmed';
            case 'Completed':
                return 'status-completed';
            case 'Cancelled':
                return 'status-cancelled';
            default:
                return 'status-default';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="booking-detail-container">
                <div className="loading">Loading booking details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="booking-detail-container">
                <div className="error-message">
                    {error}
                    <Link to="/bookings" className="btn btn-primary">
                        Back to Bookings
                    </Link>
                </div>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="booking-detail-container">
                <div className="error-message">
                    Booking not found
                    <Link to="/bookings" className="btn btn-primary">
                        Back to Bookings
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="booking-detail-container">
            <div className="booking-detail-header">
                <h2>Booking Details</h2>
                <Link to="/bookings" className="btn btn-secondary">
                    ← Back to Bookings
                </Link>
            </div>

            <div className="booking-detail-content">
                <div className="booking-overview">
                    <div className="booking-title">
                        <h3>{booking.productName}</h3>
                        <span className={`status ${getStatusColor(booking.orderStatus)}`}>
                            {booking.orderStatus}
                        </span>
                    </div>
                    
                    <div className="booking-id">
                        <strong>Booking ID:</strong> #{booking.id}
                    </div>
                </div>

                <div className="booking-sections">
                    <div className="section">
                        <h4>Tour Information</h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Tour Name:</span>
                                <span className="value">{booking.productName}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Number of People:</span>
                                <span className="value">{booking.quantity}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Price per Person:</span>
                                <span className="value">{formatVND(booking.price)}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Total Amount:</span>
                                <span className="value total">{formatVND(booking.orderTotal)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="section">
                        <h4>Booking Information</h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Booking Date:</span>
                                <span className="value">{formatDate(booking.orderDate)}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Booking Status:</span>
                                <span className={`value status ${getStatusColor(booking.orderStatus)}`}>
                                    {booking.orderStatus}
                                </span>
                            </div>
                            {booking.travelDate && (
                                <div className="info-item">
                                    <span className="label">Travel Date:</span>
                                    <span className="value">{formatDate(booking.travelDate)}</span>
                                </div>
                            )}
                            {booking.specialRequests && (
                                <div className="info-item full-width">
                                    <span className="label">Special Requests:</span>
                                    <span className="value">{booking.specialRequests}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="section">
                        <h4>What's Next?</h4>
                        <div className="next-steps">
                            {booking.orderStatus === 'Pending' && (
                                <div className="step">
                                    <div className="step-icon">⏳</div>
                                    <div className="step-content">
                                        <h5>Booking Under Review</h5>
                                        <p>Your booking is being reviewed by our team. You'll receive a confirmation email within 24 hours.</p>
                                    </div>
                                </div>
                            )}
                            
                            {booking.orderStatus === 'Confirmed' && (
                                <div className="step">
                                    <div className="step-icon">✅</div>
                                    <div className="step-content">
                                        <h5>Booking Confirmed</h5>
                                        <p>Your booking has been confirmed! Check your email for detailed instructions and meeting point information.</p>
                                    </div>
                                </div>
                            )}
                            
                            {booking.orderStatus === 'Completed' && (
                                <div className="step">
                                    <div className="step-icon">🎉</div>
                                    <div className="step-content">
                                        <h5>Tour Completed</h5>
                                        <p>We hope you enjoyed your tour! Please leave a review to help other travelers.</p>
                                    </div>
                                </div>
                            )}
                            
                            {booking.orderStatus === 'Cancelled' && (
                                <div className="step">
                                    <div className="step-icon">❌</div>
                                    <div className="step-content">
                                        <h5>Booking Cancelled</h5>
                                        <p>This booking has been cancelled. If you have any questions, please contact our support team.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="booking-actions">
                    {booking.orderStatus !== 'Cancelled' && booking.orderStatus !== 'Completed' && (
                        <button 
                            className="btn btn-danger"
                            onClick={handleCancelBooking}
                            disabled={cancelling}
                        >
                            {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                    )}
                    
                    <Link to="/booking/new" className="btn btn-primary">
                        Book Another Tour
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default BookingDetail;











import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { getUserBookings, cancelBooking, startPayment, getBookingById } from '../../services/bookingService';
import { useAuth } from '../../contexts/AuthContext';
import { formatVND } from '../../utils/currency';
import '../../assets/styles/BookingsList.scss';

const BookingsList = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancellingId, setCancellingId] = useState(null);
    const location = useLocation();
    
    // Get status filter from URL parameter, default to 'Pending'
    const getInitialStatusFilter = () => {
        const params = new URLSearchParams(location.search);
        const statusParam = params.get('status');
        const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'All'];
        return validStatuses.includes(statusParam) ? statusParam : 'Pending';
    };
    
    const [statusFilter, setStatusFilter] = useState(getInitialStatusFilter());
    const [nowMs, setNowMs] = useState(Date.now());

    const navigate = useNavigate();
    const { user } = useAuth();

    // Update filter when URL parameter changes
    useEffect(() => {
        const newFilter = getInitialStatusFilter();
        setStatusFilter(newFilter);
    }, [location.search]);

    useEffect(() => {
        loadBookings();
    }, []);

    // Tick every second so the Pending countdown updates live.
    useEffect(() => {
        const t = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    
    const loadBookings = async () => {
        try {
            setLoading(true);
            setError(''); // Clear previous errors
            const response = await getUserBookings();
            if (response.errCode === 0) {
                setBookings(response.bookings || []);
                setError(''); // Clear error on success
            } else {
                // If response has bookings but errCode is not 0, still show them
                if (response.bookings && Array.isArray(response.bookings)) {
                    setBookings(response.bookings);
                    setError(''); // Clear error if we have data
                } else {
                    setError(response.message || 'Failed to load bookings. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error loading bookings:', error);
            const errorMessage = error?.response?.data?.message 
                || error?.message 
                || 'Failed to load bookings. Please check your connection and try again.';
            setError(errorMessage);
            // Set empty array on error so UI doesn't break
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelBooking = async (bookingId) => {
        if (!window.confirm('Are you sure you want to cancel this booking?')) {
            return;
        }

        try {
            setCancellingId(bookingId);
            const response = await cancelBooking(bookingId);

            if (response.errCode === 0) {
                // Update the booking status in the list
                setBookings(prev => prev.map(booking =>
                    booking.id === bookingId
                        ? { ...booking, orderStatus: 'Cancelled' }
                        : booking
                ));
                alert('Booking cancelled successfully!');
            } else {
                alert(response.message || 'Failed to cancel booking');
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            alert('Failed to cancel booking. Please try again.');
        } finally {
            setCancellingId(null);
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

    // Filter bookings based on selected status
    const filteredBookings = bookings.filter(booking => {
        if (statusFilter === 'All') {
            return true;
        }
        return booking.orderStatus === statusFilter;
    });

    const handleFilterChange = (status) => {
        setStatusFilter(status);
        // Update URL parameter without page reload
        const newUrl = status === 'Pending' ? '/bookings' : `/bookings?status=${status}`;
        navigate(newUrl, { replace: true });
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isPaymentExpired = (booking) => {
        if (!booking?.orderDate) return false;
        if (booking?.orderStatus !== 'Pending') return false;
        const createdAt = new Date(booking.orderDate).getTime();
        if (!Number.isFinite(createdAt)) return false;
        return (nowMs - createdAt) > (8 * 60 * 60 * 1000);
    };

    const getPaymentRemainingSeconds = (booking) => {
        if (!booking?.orderDate) return null;
        if (booking?.orderStatus !== 'Pending') return null;
        const createdAt = new Date(booking.orderDate).getTime();
        if (!Number.isFinite(createdAt)) return null;
        const remaining = Math.ceil(((8 * 60 * 60 * 1000) - (nowMs - createdAt)) / 1000);
        return Math.max(0, remaining);
    };

    const formatCountdown = (totalSeconds) => {
        const s = Math.max(0, Math.floor(totalSeconds));
        const hh = String(Math.floor(s / 3600)).padStart(2, '0');
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    };

    const pollBookingUntilFinalStatus = async (bookingId, { intervalMs = 3000, timeoutMs = 120000 } = {}) => {
        const startAt = Date.now();
        while (Date.now() - startAt < timeoutMs) {
            const resp = await getBookingById(bookingId);
            if (resp?.errCode === 0 && resp?.booking?.orderStatus) {
                const status = resp.booking.orderStatus;
                if (status !== 'Pending') return status;
            }
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        return 'Pending';
    };

    const payment = async (booking) => {
        try {
            if (booking.orderStatus !== 'Pending') {
                console.log('Payment not allowed - booking status is not Pending:', booking.orderStatus);
                alert(`Payment is only available for bookings with "Pending" status. Current status: ${booking.orderStatus}`);
                return;
            }
            if (isPaymentExpired(booking)) {
                alert('Payment window expired (8 hours). This booking will be cancelled. Please create a new booking.');
                loadBookings();
                return;
            }

            // Call payment API (e.g. MoMo). On success we get a payUrl and redirect; backend confirms only when payment succeeds.
            const amount = Number(booking.orderTotal);
            if (!Number.isFinite(amount) || amount <= 0) {
                alert('Invalid booking amount. Cannot start payment.');
                return;
            }
            const result = await startPayment(amount, booking.id);

            if (result && result.payUrl) {
                window.location.href = result.payUrl;
                return;
            }
            const errorMessage = result?.message || 'Could not start payment. Please try again.';
            alert(`Payment Error: ${errorMessage}`);
        } catch (err) {
            console.error('Payment error:', err);
            const errorMessage = err?.response?.data?.message || err?.message || 'Could not start payment. Please try again.';
            alert(`Payment Error: ${errorMessage}`);
        }
    }

    if (loading) {
        return (
            <div className="bookings-container">
                <div className="loading">Loading your bookings...</div>
            </div>
        );
    }

    return (
        <div className="bookings-container">
            <div className="bookings-header">
                <div className="header-content">
                    <div className="header-text">
                        <h1>My Bookings</h1>
                        <p>Manage your tour bookings and reservations</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    <div className="error-icon">⚠️</div>
                    <span className="error-text">{error}</span>
                    <button
                        className="error-retry-btn"
                        onClick={loadBookings}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Status Filter Buttons */}
            <div className="status-filter">
                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${statusFilter === 'Pending' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('Pending')}
                    >
                        <span className="filter-icon">⏳</span>
                        Pending
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'Confirmed' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('Confirmed')}
                    >
                        <span className="filter-icon">✅</span>
                        Confirmed
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'Completed' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('Completed')}
                    >
                        <span className="filter-icon">🎉</span>
                        Completed
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'Cancelled' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('Cancelled')}
                    >
                        <span className="filter-icon">❌</span>
                        Cancelled
                    </button>
                </div>
                <div className="filter-info">
                    <span className="filter-count">{filteredBookings.length}</span> of <span className="filter-total">{bookings.length}</span> bookings
                </div>
            </div>

            {bookings.length === 0 ? (
                <div className="no-bookings">
                    <div className="no-bookings-content">
                        <h3>No bookings found</h3>
                        <p>You haven't made any bookings yet. Start exploring our amazing tours!</p>
                        <Link to="/booking/new" className="btn btn-primary">
                            Book Your First Tour
                        </Link> 
                    </div>
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="no-bookings">
                    <div className="no-bookings-content">
                        <h3>No {statusFilter.toLowerCase()} bookings</h3>
                        <p>You don't have any bookings with "{statusFilter}" status.</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleFilterChange('Pending')}
                        >
                            View Pending Bookings
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bookings-list">
                    {filteredBookings.map(booking => (
                        <div key={booking.id} className="booking-card">
                            <div className="card-header">
                                <div className="product-info">
                                    <div className="product-icon">✈️</div>
                                    <div>
                                        <h3>{booking.productName}</h3>
                                        <span className="booking-id">Booking #{booking.id}</span>
                                    </div>
                                </div>
                                <span className={`status-badge ${getStatusColor(booking.orderStatus)}`}>
                                    {booking.orderStatus}
                                    {booking.orderStatus === 'Pending' && (
                                        <span className="status-timer">
                                            {isPaymentExpired(booking)
                                                ? ' ⏰ Expired'
                                                : ` ⏱️ ${formatCountdown(getPaymentRemainingSeconds(booking) ?? 0)}`}
                                        </span>
                                    )}
                                </span>
                            </div>

                            <div className="booking-details">
                                <div className="detail-section">
                                    <div className="detail-item">
                                        <span className="detail-icon">📅</span>
                                        <div className="detail-content">
                                            <span className="detail-label">Booking Date</span>
                                            <span className="detail-value">{formatDate(booking.orderDate)}</span>
                                        </div>
                                    </div>

                                    <div className="detail-item">
                                        <span className="detail-icon">👥</span>
                                        <div className="detail-content">
                                            <span className="detail-label">Number of People</span>
                                            <span className="detail-value">{booking.quantity} {booking.quantity === 1 ? 'person' : 'people'}</span>
                                        </div>
                                    </div>

                                    <div className="detail-item">
                                        <span className="detail-icon">💰</span>
                                        <div className="detail-content">
                                            <span className="detail-label">Price per Person</span>
                                            <span className="detail-value">{formatVND(booking.price)}</span>
                                        </div>
                                    </div>
                                </div>

                                {booking.originalTotal && booking.originalTotal > booking.orderTotal && (
                                    <div className="discount-banner">
                                        <span className="discount-icon">🎁</span>
                                        <div className="discount-info">
                                            <span className="discount-label">You saved</span>
                                            <span className="discount-amount">-{formatVND(booking.discountAmount || 0)} ({booking.discountRate?.toFixed(1) || '0'}% OFF)</span>
                                        </div>
                                    </div>
                                )}

                                <div className="price-breakdown">
                                    <div className="breakdown-item">
                                        <span className="breakdown-label">Subtotal</span>
                                        <span className="breakdown-value">{formatVND(booking.orderTotal)}</span>
                                    </div>
                                    <div className="breakdown-item tip-item">
                                        <span className="breakdown-label">
                                            <span className="tip-icon">💡</span> Service Tip (5%)
                                        </span>
                                        <span className="breakdown-value">{formatVND(Math.round(booking.orderTotal * 0.05))}</span>
                                    </div>
                                </div>

                                <div className="total-section">
                                    <span className="total-label">Total Amount</span>
                                    <span className={`total-amount ${booking.originalTotal && booking.originalTotal > booking.orderTotal ? 'discounted' : ''}`}>
                                        {formatVND(Math.round(booking.orderTotal * 1.05))}
                                    </span>
                                </div>
                            </div>

                            <div className="booking-actions">
                                <button
                                    className="action-btn btn-view"
                                    onClick={() => navigate(`/booking/${booking.id}`)}
                                >
                                    <span>👁️</span> View Details
                                </button>

                                {booking.orderStatus !== 'Cancelled' && booking.orderStatus !== 'Completed' && (
                                    <button
                                        className="action-btn btn-cancel"
                                        onClick={() => handleCancelBooking(booking.id)}
                                        disabled={cancellingId === booking.id}
                                    >
                                        <span>{cancellingId === booking.id ? '⏳' : '❌'}</span>
                                        {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                                    </button>
                                )}

                                <button
                                    className={`action-btn btn-payment ${booking.orderStatus === 'Pending' && !isPaymentExpired(booking) ? 'primary' : 'disabled'}`}
                                    onClick={() => payment(booking)}
                                    disabled={!user || booking.orderStatus !== 'Pending' || isPaymentExpired(booking)}
                                    title={
                                        !user 
                                            ? "Login to make payment" 
                                            : booking.orderStatus !== 'Pending' 
                                                ? `Payment only available for Pending bookings. Current status: ${booking.orderStatus}`
                                                : isPaymentExpired(booking)
                                                    ? "Payment window expired (8 hours). Booking will be cancelled."
                                                    : "Make payment with MoMo"
                                    }
                                >
                                    <span>💳</span>
                                    {!user 
                                        ? "Login Required" 
                                        : booking.orderStatus !== 'Pending' 
                                            ? `Payment (${booking.orderStatus})` 
                                            : isPaymentExpired(booking)
                                                ? "Payment Expired"
                                                : "Pay Now"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BookingsList;











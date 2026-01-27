import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../assets/styles/ProductDetails.scss";
import { createBooking, createGuestBooking, getBookingById, getProducts, getTravelDatesByProductId, startPayment, logExperimentExposure } from "../../services/bookingService";
import { useAuth } from "../../contexts/AuthContext";

const ProductDetails = () => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [productsError, setProductsError] = useState('');
    const [guestModalOpen, setGuestModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [travelDates, setTravelDates] = useState([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState('');
    const [travelDatesLoading, setTravelDatesLoading] = useState(false);
    const [guestForm, setGuestForm] = useState({
        email: '',
        phoneNumber: '',
        firstName: '',
        lastName: '',
        address: '',
        gender: '' // 'male' | 'female' | 'other'
    });

    const genderToBool = useMemo(() => {
        // Convert to boolean expected by backend (true/false).
        // We map: male=true, female=false, other=false (can be extended if backend supports more values)
        if (guestForm.gender === 'male') return true;
        if (guestForm.gender === 'female') return false;
        if (guestForm.gender === 'other') return false;
        return null;
    }, [guestForm.gender]);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                setProductsLoading(true);
                setProductsError('');
                const res = await getProducts();
                if (res?.errCode === 0 && Array.isArray(res.products)) {
                    setProducts(res.products);
                } else if (Array.isArray(res?.products)) {
                    // fallback if backend returns plain {products}
                    setProducts(res.products);
                } else {
                    setProducts([]);
                    setProductsError(res?.message || 'Failed to load tours');
                }
            } catch (e) {
                console.error('Failed to load tours:', e);
                setProductsError('Failed to load tours. Please try again.');
                setProducts([]);
            } finally {
                setProductsLoading(false);
            }
        };
        loadProducts();
        
        // Listen for experiment updates to refresh products
        const handleExperimentUpdate = () => {
            console.log('Experiment updated, refreshing products...');
            loadProducts();
        };
        
        window.addEventListener('experimentUpdated', handleExperimentUpdate);
        
        return () => {
            window.removeEventListener('experimentUpdated', handleExperimentUpdate);
        };
    }, []);

    const searchParam = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return (params.get('search') || '').trim();
    }, [location.search]);

    const filteredProducts = useMemo(() => {
        if (!searchParam) return products;
        const q = searchParam.toLowerCase();
        return products.filter(p => (p?.name || '').toLowerCase().includes(q));
    }, [products, searchParam]);

    const handleBookNow = async (item) => {
        // Exposure tracking (user intent)
        try {
            await logExperimentExposure({ productId: item?.product_id, event: 'book_now', basePrice: item?.basePrice ?? null });
        } catch (e) {
            // ignore
        }

        const msDay = 24 * 60 * 60 * 1000;
        const isScheduleBookable = (d) => {
            const startStr = d?.formatted_start_date;
            const startDate = startStr ? new Date(startStr) : (d?.start_date ? new Date(d.start_date) : null);
            if (!startDate || Number.isNaN(startDate.getTime())) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startDate.setHours(0, 0, 0, 0);
            const diffDays = (startDate.getTime() - today.getTime()) / msDay;
            return diffDays > 1; // must be at least 2 days ahead
        };

        // If not authenticated, allow guest booking via modal form
        if (!isAuthenticated()) {
            setSelectedItem(item);
            setGuestModalOpen(true);
            // Load available travel dates for this product for guest booking
            try {
                setTravelDatesLoading(true);
                const res = await getTravelDatesByProductId(item.product_id);
                const dates = (res?.data || []).filter(isScheduleBookable);
                setTravelDates(dates);
                setSelectedScheduleId(dates?.[0]?.schedule_id ? String(dates[0].schedule_id) : '');
            } catch (e) {
                console.error('Failed to load travel dates:', e);
                setTravelDates([]);
                setSelectedScheduleId('');
            } finally {
                setTravelDatesLoading(false);
            }
            return;
        }

        setLoading(true);
        try {
            // Pick the earliest available schedule from backend
            const scheduleRes = await getTravelDatesByProductId(item.product_id);
            const dates = (scheduleRes?.data || []).filter(isScheduleBookable);
            if (!dates.length) {
                alert('No available travel dates for this tour (must be booked at least 2 days before start). Please choose another tour.');
                return;
            }
            const selected = dates[0];

            const bookingData = {
                productId: item.product_id,
                quantity: 1,
                travelDate: selected.formatted_start_date || new Date(selected.start_date).toISOString().split('T')[0],
                scheduleId: selected.schedule_id,
                specialRequests: '',
                paymentMethodId: 1
            };

            const response = await createBooking(bookingData);
            if (response.errCode === 0) {
                alert("Booking successful! Redirecting to your bookings...");
                navigate('/bookings');
            } else {
                alert(response.message || "Booking failed. Please try again.");
            }
        } catch (error) {
            console.error("Booking error:", error);
            alert("Booking failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const submitGuestBooking = async () => {
        if (!selectedItem) return;
        if (!guestForm.email || !guestForm.phoneNumber || !guestForm.firstName || !guestForm.lastName || !guestForm.address || genderToBool === null) {
            alert('Please fill all required fields (including gender).');
            return;
        }
        if (!selectedScheduleId) {
            alert('Please select a travel date.');
            return;
        }

        setLoading(true);
        try {
            const selected = travelDates.find(d => String(d.schedule_id) === String(selectedScheduleId));
            const travelDateValue = selected?.formatted_start_date || (selected?.start_date ? new Date(selected.start_date).toISOString().split('T')[0] : null);

            const payload = {
                // guest info
                email: guestForm.email,
                phoneNumber: guestForm.phoneNumber,
                firstName: guestForm.firstName,
                lastName: guestForm.lastName,
                address: guestForm.address,
                gender: genderToBool,
                // booking info
                productId: selectedItem.product_id,
                quantity: 1,
                travelDate: travelDateValue,
                scheduleId: Number(selectedScheduleId),
                specialRequests: '',
                paymentMethodId: 1
            };

            const response = await createGuestBooking(payload);
            if (response.errCode === 0) {
                // Guest must pay immediately (no pending access). Use the short-lived token returned by backend.
                if (response.access_token) {
                    localStorage.setItem('access_token', response.access_token);
                }
                if (response.guestUser) {
                    localStorage.setItem('user', JSON.stringify(response.guestUser));
                }

                const bookingId = response.booking?.id;
                const orderTotal = Number(response.booking?.orderTotal || 0);
                // MoMo expects VND as an integer amount. orderTotal is already VND in this app.
                const amount = String(Math.round(orderTotal));

                if (!bookingId || !orderTotal) {
                    alert('Booking created but missing payment details. Please contact support.');
                    return;
                }

                console.log('Starting payment with amount:', amount, 'bookingId:', bookingId);
                const payRes = await startPayment(amount, bookingId);
                console.log('Payment response:', payRes);
                
                if (!payRes?.payUrl && !payRes?.deeplink) {
                    alert(payRes?.message || 'Failed to start MoMo payment. Please try again.');
                    return;
                }

                let finalStatus = 'Pending';

                if (payRes?.payUrl) {
                    const paymentWindow = window.open(payRes.payUrl, '_blank', 'width=800,height=600');
                    if (!paymentWindow) {
                        alert('Popup blocked. Please allow popups for this site to complete payment.');
                        return;
                    }

                    alert('Payment window opened. After completing payment, this page will update once confirmation is received.');

                    // Poll booking status until it becomes Confirmed or Cancelled
                    const startAt = Date.now();
                    const timeoutMs = 120000;
                    const intervalMs = 3000;

                    while (Date.now() - startAt < timeoutMs) {
                        const statusRes = await getBookingById(bookingId);
                        const status = statusRes?.booking?.orderStatus;
                        if (status && status !== 'Pending') {
                            finalStatus = status;
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, intervalMs));
                    }

                    try {
                        if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
                    } catch (e) {
                        // ignore window close errors
                    }
                } else if (payRes?.deeplink) {
                    // Redirect to MoMo app via deeplink
                    window.location.href = payRes.deeplink;
                    return;
                }

                // Clear guest auth from storage (visitor remains not-logged-in)
                localStorage.removeItem('access_token');
                localStorage.removeItem('user');

                if (finalStatus === 'Confirmed') {
                    alert('Payment completed successfully! Your booking is confirmed.');
                    // Navigate to bookings page with Confirmed filter
                    navigate('/bookings?status=Confirmed');
                } else if (finalStatus === 'Cancelled') {
                    alert('Payment failed or was cancelled. Your booking was not confirmed.');
                    // Navigate to bookings page (stays on default Pending filter)
                    navigate('/bookings');
                } else {
                    alert('Payment is still pending. If you already paid, please wait and try again.');
                    // Navigate to bookings page (stays on default Pending filter)
                    navigate('/bookings');
                }

                setGuestModalOpen(false);
                setSelectedItem(null);
                setGuestForm({ email: '', phoneNumber: '', firstName: '', lastName: '', address: '', gender: '' });
                setTravelDates([]);
                setSelectedScheduleId('');
            } else {
                alert(response.message || 'Guest booking failed. Please try again.');
            }
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Guest booking failed. Please try again.';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    
    return (
        <>
            {/* <Nav /> */}
            <div className="product-details-container">
                <h2>Travel Packages</h2>
                <div className="product-list">
                    {productsLoading ? (
                        <div style={{ padding: '1rem', color: '#666' }}>Loading tours...</div>
                    ) : productsError ? (
                        <div style={{ padding: '1rem', color: '#c0392b' }}>{productsError}</div>
                    ) : filteredProducts.length === 0 ? (
                        <div style={{ padding: '1rem', color: '#666' }}>
                            {searchParam ? `No tours match "${searchParam}".` : 'No tours available.'}
                        </div>
                    ) : (
                        filteredProducts.map((item) => (
                        <div key={item.id || item.product_item_id || item.stock_keeping_unit || item.product_id} className="product-card">
                            <img
                                src={item.image || "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80"}
                                alt={`Tour ${item.product_id || item.id}`}
                                className="product-image"
                            />
                            <div className="product-info">
                                <p>
                                    <strong>Name:</strong> {item.name || 'N/A'}
                                </p>
                                <p>
                                    <strong>Description:</strong> {item.description || 'N/A'}
                                </p>
                                <p>
                                    <strong>Price:</strong> ${Number(item.price || 0).toFixed(2)}
                                </p>
                                <button
                                    className="order-button"
                                    onClick={() => handleBookNow(item)}
                                    disabled={loading || productsLoading}
                                >
                                    {loading ? "Booking..." : "Book Now"}
                                </button>
                            </div>
                        </div>
                    )))}
                </div>
            </div>

            {/* Guest booking modal */}
            {guestModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}
                    onClick={() => !loading && setGuestModalOpen(false)}
                >
                    <div
                        style={{
                            width: 'min(720px, 92vw)',
                            background: '#fff',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Guest Booking</h3>
                            <button
                                type="button"
                                onClick={() => setGuestModalOpen(false)}
                                disabled={loading}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '1.25rem',
                                    cursor: 'pointer'
                                }}
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ marginTop: '0.5rem', color: '#666' }}>
                            To place an order without registering, please enter your information.
                        </p>

                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '10px' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Select Travel Date *</div>
                            {travelDatesLoading ? (
                                <div style={{ color: '#666' }}>Loading available travel dates...</div>
                            ) : travelDates.length === 0 ? (
                                <div style={{ color: '#c0392b' }}>
                                    No available travel dates for this tour. Please close and choose another tour.
                                </div>
                            ) : (
                                <select
                                    value={selectedScheduleId}
                                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff' }}
                                >
                                    {travelDates.map((d) => (
                                        <option key={d.schedule_id} value={String(d.schedule_id)}>
                                            {d.formatted_start_date || d.start_date} → {d.formatted_end_date || d.end_date} (Available: {d.available_quantity ?? 'N/A'})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                            <div>
                                <label>Email *</label>
                                <input
                                    value={guestForm.email}
                                    onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                                    type="email"
                                    placeholder="you@example.com"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div>
                                <label>Phone Number *</label>
                                <input
                                    value={guestForm.phoneNumber}
                                    onChange={(e) => setGuestForm({ ...guestForm, phoneNumber: e.target.value })}
                                    type="tel"
                                    placeholder="(000) 000-0000"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div>
                                <label>First Name *</label>
                                <input
                                    value={guestForm.firstName}
                                    onChange={(e) => setGuestForm({ ...guestForm, firstName: e.target.value })}
                                    type="text"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div>
                                <label>Last Name *</label>
                                <input
                                    value={guestForm.lastName}
                                    onChange={(e) => setGuestForm({ ...guestForm, lastName: e.target.value })}
                                    type="text"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label>Address *</label>
                                <input
                                    value={guestForm.address}
                                    onChange={(e) => setGuestForm({ ...guestForm, address: e.target.value })}
                                    type="text"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label>Gender *</label>
                                <select
                                    value={guestForm.gender}
                                    onChange={(e) => setGuestForm({ ...guestForm, gender: e.target.value })}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff' }}
                                >
                                    <option value="">Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setGuestModalOpen(false)}
                                disabled={loading}
                                style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitGuestBooking}
                                disabled={loading}
                                style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: '#1e90ff', color: '#fff' }}
                            >
                                {loading ? 'Submitting...' : 'Place Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductDetails;

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProducts, createBooking, getActivePromotions, getTravelDatesByProductId, logExperimentExposure } from '../../services/bookingService';
import { useAuth } from '../../contexts/AuthContext';
import { formatVND } from '../../utils/currency';
import '../../assets/styles/BookingForm.scss';

const BookingForm = () => {
    const [formData, setFormData] = useState({
        productId: '',
        quantity: 1,
        travelDate: '',
        specialRequests: '',
        paymentMethodId: 1,
    });
    const [selectedSchedule, setSelectedSchedule] = useState(null);

    const [promo, setPromo] = useState('');
    const [discount, setDiscount] = useState(null);

    const [products, setProducts] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [travelDates, setTravelDates] = useState([]);
    const [loadingDates, setLoadingDates] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate();
    const { productId: urlProductId } = useParams();
    const { user } = useAuth();

    const fetchTravelDates = async (productId) => {
        if (!productId) return;
        
        setLoadingDates(true);
        setTravelDates([]);
        setFormData(prev => ({ ...prev, travelDate: '' })); // Reset travel date
        
        try {
            const response = await getTravelDatesByProductId(productId);
            if (response.errCode === 0 && response.data) {
                setTravelDates(response.data);
            } else {
                setTravelDates([]);
            }
        } catch (error) {
            console.error('Error fetching travel dates:', error);
            setTravelDates([]);
        } finally {
            setLoadingDates(false);
        }
    };

    useEffect(() => {
        loadProducts();
        loadPromotions();
        if (urlProductId) {
            setFormData(prev => ({ ...prev, productId: urlProductId }));
            // Fetch travel dates for the product from URL
            fetchTravelDates(urlProductId);
        }
        
        // Listen for experiment updates to refresh products
        const handleExperimentUpdate = () => {
            console.log('Experiment updated, refreshing products...');
            loadProducts();
        };
        
        window.addEventListener('experimentUpdated', handleExperimentUpdate);
        
        return () => {
            window.removeEventListener('experimentUpdated', handleExperimentUpdate);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlProductId]);

    const loadProducts = async () => {
        try {
            const response = await getProducts();
            if (response.errCode === 0) {
                setProducts(response.products);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    };

    const loadPromotions = async () => {
        try {
            const response = await getActivePromotions();
            if (response.errCode === 0) {
                setPromotions(response.promotions || []);
                console.log('Loaded promotions:', response.promotions);
            }
        } catch (error) {
            console.error('Error loading promotions:', error);
        }
    };
    
    const handlePromoChange = (value) => {
        setPromo(value);

        if (!value) {
            setDiscount(null);
            return;
        }

        // Find the selected promotion
        const selectedPromotion = promotions.find(p => p.id.toString() === value);
        if (selectedPromotion) {
            // All promotions use percentage discount based on discount_rate
            setDiscount({ 
                type: "percent", 
                value: parseFloat(selectedPromotion.discount_rate) || 0 
            });
        } else {
            setDiscount(null);
        }
    };

    const handleChange = async (e) => {
        const { name, value } = e.target;
        
        if (name === 'travelDate') {
            // Find the selected schedule by schedule_id (value is now schedule_id)
            const schedule = travelDates.find(d => {
                const scheduleId = d.schedule_id || d.id;
                return scheduleId.toString() === value.toString();
            });
            setSelectedSchedule(schedule);
            // Reset quantity to 1 when travel date changes
            setFormData(prev => ({
                ...prev,
                [name]: value,
                quantity: 1
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // When product is selected, fetch travel dates
        if (name === 'productId' && value) {
            // value is now product_item.id, but we need product_id for getTravelDatesByProductId
            const selectedProduct = products.find(p => p.id.toString() === value.toString());
            const productIdToFetch = selectedProduct?.product_id || value; // Use product_id for fetching dates
            // Exposure tracking (selection)
            logExperimentExposure({ productId: productIdToFetch, event: 'select', basePrice: selectedProduct?.basePrice ?? null });
            fetchTravelDates(productIdToFetch);
            setSelectedSchedule(null);
            setFormData(prev => ({ ...prev, travelDate: '', quantity: 1 }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.productId) newErrors.productId = 'Please select a tour';
        if (!formData.quantity || formData.quantity < 1) newErrors.quantity = 'Quantity must be at least 1';
        if (!formData.travelDate) newErrors.travelDate = 'Please select a travel date';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setSuccessMessage('');

        const userName = (user?.firstName || '') + (user?.lastName || '');
        const orderDate = new Date();

        // Convert product_item_id to product_id for backend
        const selectedProduct = products.find(p => p.id.toString() === formData.productId.toString());
        const productIdForBooking = selectedProduct?.product_id || formData.productId;

        // Get schedule_id from selectedSchedule (travelDate now contains schedule_id)
        const scheduleId = selectedSchedule?.schedule_id || selectedSchedule?.id || formData.travelDate;

        const bookingData = {
            ...formData,
            productId: productIdForBooking, // Use product_id instead of product_item_id
            scheduleId: scheduleId, // Send schedule_id to backend
            travelDate: selectedSchedule?.formatted_start_date || selectedSchedule?.start_date || formData.travelDate, // Keep for backward compatibility
            promotionId: promo ? parseInt(promo) : null, // Include promotion ID if selected (ensure it's a number)
            userName,
            orderDate
        };
        
        console.log('BookingForm: Sending booking data with promotion:', {
            promotionId: bookingData.promotionId,
            promo: promo,
            productId: bookingData.productId,
            scheduleId: bookingData.scheduleId,
            product_item_id: formData.productId, // Original selection
            quantity: bookingData.quantity
        });

        try {
            const response = await createBooking(bookingData);
            console.log('Booking response:', response);
            if (response.errCode === 0) {
                setSuccessMessage('Booking created successfully! Redirecting...');
                // Reset form state after successful booking
                setFormData({
                    productId: '',
                    quantity: 1,
                    travelDate: '',
                    specialRequests: '',
                    paymentMethodId: 1,
                });
                setSelectedSchedule(null);
                setTravelDates([]);
                setPromo('');
                setDiscount(null);
                setErrors({});
                // Reload products to get fresh data
                loadProducts();
                setTimeout(() => navigate('/bookings'), 2000);
            } else {
                const errorMessage = response.message || response.data?.message || 'Booking failed';
                console.error('Booking failed with error:', errorMessage, response);
                setErrors({ general: errorMessage });
            }
        } catch (error) {
            console.error('Booking error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Booking failed. Try again.';
            setErrors({ general: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    const selectedProduct = products.find(p => p.id === parseInt(formData.productId));
    let subtotal = selectedProduct ? selectedProduct.price * formData.quantity : 0;
    let totalPrice = subtotal;

    // Apply discount if any
    if (discount) {
        if (discount.type === "percent") {
            totalPrice = totalPrice - (totalPrice * discount.value / 100);
        } else if (discount.type === "fixed") {
            totalPrice = Math.max(0, totalPrice - discount.value);
        }
    }

    // Calculate 5% tip on the price after discount
    const tipRate = 0.05; // 5%
    const tipAmount = totalPrice * tipRate;
    const finalTotal = totalPrice + tipAmount;

    return (
        <div className="booking-form-container">
            <div className="booking-form-content">
                <h2>Create New Booking</h2>
                <p className="subtitle">Book your dream tour experience</p>

                {successMessage && <div className="success-message">{successMessage}</div>}
                {errors.general && <div className="error-message">{errors.general}</div>}

                <form onSubmit={handleSubmit}>

                    <div className="form-group">
                        <label>Select Tour *</label>
                        <select
                            name="productId"
                            value={formData.productId}
                            onChange={handleChange}
                            className={errors.productId ? "form-control error" : "form-control"}
                        >
                            <option value="">Choose a tour...</option>
                            {products.map(product => (
                                <option key={product.id} value={product.id}>
                                    {product.name} - {formatVND(product.price)}
                                </option>
                            ))}
                        </select>
                        {errors.productId && <span className="error-text">{errors.productId}</span>}
                    </div>

                    <div className="form-group">
                        <label>Promo Discount</label>
                        <select
                            value={promo}
                            onChange={(e) => handlePromoChange(e.target.value)}
                            className="form-control"
                        >
                            <option value="">No discount</option>
                            {promotions.map(promotion => (
                                <option key={promotion.id} value={promotion.id}>
                                    {promotion.name} - {promotion.discount_rate}% OFF
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Travel Date */}
                    <div className="form-group">
                        <label>Travel Date *</label>
                        {!formData.productId ? (
                            <input
                                type="text"
                                value="Please select a tour first"
                                disabled
                                className="form-control"
                                style={{ opacity: 0.6, cursor: 'not-allowed' }}
                            />
                        ) : loadingDates ? (
                            <select disabled className="form-control">
                                <option>Loading available dates...</option>
                            </select>
                        ) : travelDates.length === 0 ? (
                            <select disabled className="form-control">
                                <option>No available dates for this tour</option>
                            </select>
                        ) : (
                            <select
                                name="travelDate"
                                value={formData.travelDate}
                                onChange={handleChange}
                                className={errors.travelDate ? "form-control error" : "form-control"}
                            >
                                <option value="">Select a travel date...</option>
                                {travelDates.map((dateOption, index) => {
                                    const startDate = dateOption.formatted_start_date || dateOption.start_date;
                                    const endDate = dateOption.formatted_end_date || dateOption.end_date;
                                    const availableQty = dateOption.available_quantity || 0;
                                    const scheduleId = dateOption.schedule_id || dateOption.id; // Use schedule_id as unique identifier
                                    const displayDate = startDate === endDate 
                                        ? `${startDate} (${availableQty} tickets available)`
                                        : `${startDate} to ${endDate} (${availableQty} tickets available)`;
                                    return (
                                        <option key={scheduleId || index} value={scheduleId} disabled={availableQty === 0}>
                                            {displayDate}
                                        </option>
                                    );
                                })}
                            </select>
                        )}
                        {errors.travelDate && <span className="error-text">{errors.travelDate}</span>}
                    </div>

                    {/* Quantity - Only show after travel date is selected */}
                    {formData.travelDate && selectedSchedule && (
                        <div className="form-group">
                            <label>Number of Tickets *</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                min="1"
                                max={selectedSchedule.available_quantity || 1}
                                className="form-control"
                            />
                            <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
                                Available: {selectedSchedule.available_quantity || 0} ticket(s)
                                {selectedSchedule.available_quantity === 0 && (
                                    <span style={{ color: "red", marginLeft: "8px" }}>
                                        (Out of stock)
                                    </span>
                                )}
                            </small>
                            {errors.quantity && <span className="error-text">{errors.quantity}</span>}
                        </div>
                    )}

                    {/* Payment Method */}
                    <div className="form-group">
                        <label>Payment Method *</label>
                        <select
                            name="paymentMethodId"
                            value={formData.paymentMethodId}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value={1}>MoMo</option>
                            <option value={2}>Debit Card</option>
                            <option value={3}>PayPal</option>
                        </select>
                    </div>

                    {/* Price Summary */}
                    {subtotal > 0 && (
                        <div className="price-summary-card">
                            <h4>💰 Price Summary</h4>
                            <p>Price per person: {formatVND(selectedProduct?.price)}</p>
                            {selectedProduct?.experiment && (
                                <p style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                                    🧪 Experiment: {selectedProduct.experiment.variant === 'treatment' ? 'Treatment' : 'Control'} 
                                    {selectedProduct.experiment.multiplier !== 1 && (
                                        <span> ({selectedProduct.experiment.multiplier > 1 ? '+' : ''}{((selectedProduct.experiment.multiplier - 1) * 100).toFixed(1)}%)</span>
                                    )}
                                </p>
                            )}
                            <p>Quantity: {formData.quantity}</p>
                            <p style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px', marginTop: '8px' }}>
                                Subtotal: {formatVND(subtotal)}
                            </p>
                            {discount && (
                                <p style={{ color: '#4ade80' }}>
                                    Discount ({discount.type === "percent" ? `${discount.value}%` : 'Fixed'}): -{formatVND(subtotal - totalPrice)}
                                </p>
                            )}
                            {discount && (
                                <p style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px', marginTop: '8px' }}>
                                    After Discount: {formatVND(totalPrice)}
                                </p>
                            )}
                            <p style={{ color: '#fbbf24', fontWeight: '500' }}>
                                💡 Service Tip (5%): {formatVND(tipAmount)}
                            </p>
                            <h3 style={{ borderTop: '2px solid rgba(255,255,255,0.3)', paddingTop: '12px', marginTop: '12px' }}>
                                Final Total: {formatVND(finalTotal)}
                            </h3>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Creating..." : "Create Booking"}
                        </button>

                        <button type="button" className="btn btn-secondary" onClick={() => navigate('/bookings')}>
                            Cancel
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default BookingForm;

import React, { useState, useEffect } from 'react';
import { Star, Send, Loader2, MessageSquare, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import userService from "../../services/userService";
import '../../assets/styles/Survey.scss';

const Survey = ({ userId = 1, onSurveyCompleted }) => {
  const [formData, setFormData] = useState({
    userId: userId,
    shop_order_id: '',
    rating: 0,
    comment:'',
  });

  const [reviewableItems, setReviewableItems] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [hoverRating, setHoverRating] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });

  // Fetch reviewable products (Completed status only) on component mount
  useEffect(() => {
    const fetchReviewableProducts = async () => {
      try {
        setLoadingProducts(true);
        const response = await userService.getReviewableProducts();
        if (response.errCode === 0 && response.data) {
          setReviewableItems(response.data);
        }
      } catch (error) {
        console.error("Error fetching reviewable products:", error);
        setReviewableItems([]);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchReviewableProducts();
  }, []);

  const handleRating = (value) => {
    setFormData(prev=>({...prev,rating:value}))
    if(status.type==='error') setStatus({type:null,message:''});
  };

  const handleComment = (e) =>{
    setFormData(prev=>({...prev,comment:e.target.value}))
    if(status.type==='error') setStatus({type:null,message:''});
  }

  const handleOrderChange = (e) => {
    setFormData(prev=>({...prev,shop_order_id:e.target.value}))
    if(status.type==='error') setStatus({type:null,message:''});
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.rating === 0) {
      setStatus({ type: 'error', message: 'Please select a star rating.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await userService.handleSurveyAPI({
        shop_order_id: formData.shop_order_id || null,
        rating: formData.rating,
        comment: formData.comment
      });
      
      if (response.errCode === 0) {
        setStatus({ 
          type: 'success', 
          message: response.errMessage || 'Thank you for your feedback!' 
        });
        // Call callback if provided
        if (onSurveyCompleted) {
          onSurveyCompleted(response.data);
        }
      } else {
        setStatus({ 
          type: 'error', 
          message: response.errMessage || 'Failed to submit survey.' 
        });
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.errMessage || 
                          error.message || 
                          'Failed to connect to the server.';
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="survey-container">
      <div className="survey-content">
        {/* Header */}
        <div className="survey-header">
          <div className="header-icon">
            <MessageSquare size={30} />
          </div>
          <h2>Customer Feedback</h2>
          <p>Share your experience and help us improve</p>
        </div>

        <div className="survey-body">
          {status.type === 'success' ? (
            <div className="success-state">
              <div className="success-icon">
                <CheckCircle2 size={40} color="white" />
              </div>
              <h3>Thank You!</h3>
              <p>{status.message}</p>
              <button
                onClick={() => {
                  setStatus({ type: null, message: '' });
                  setFormData(prev => ({ ...prev, rating: 0, comment: '', shop_order_id: '' }));
                }}
                className="btn-reset"
              >
                <MessageSquare size={18} />
                Submit Another Review
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="survey-form">

              {/* Order Selection Section */}
              <div className="form-section">
                <label htmlFor="shop_order_id">
                  <Package className="label-icon" size={18} />
                  Select Your Order
                  <span className="optional-badge">(Optional)</span>
                </label>
                <select
                  id="shop_order_id"
                  value={formData.shop_order_id}
                  onChange={handleOrderChange}
                  disabled={loadingProducts}
                >
                  <option value="">-- Choose an order to review --</option>
                  {loadingProducts ? (
                    <option disabled>Loading orders...</option>
                  ) : reviewableItems.length > 0 ? (
                    reviewableItems.map((item) => (
                      <option key={item.shop_order_id || item.order_id} value={item.shop_order_id || item.order_id}>
                        {item.display_text}
                      </option>
                    ))
                  ) : (
                    <option disabled>No orders available for review</option>
                  )}
                </select>
                {reviewableItems.length === 0 && !loadingProducts && (
                  <div className="info-message">
                    You can only review orders with <strong>Completed</strong> status.
                  </div>
                )}
              </div>

              {/* Star Rating Section */}
              <div className="rating-section">
                <label>
                  How would you rate your experience?
                  <span className="required-star">*</span>
                </label>

                <div className="stars-container" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      className="star-button"
                    >
                      <Star
                        size={48}
                        className={`star-icon ${
                          star <= (hoverRating || formData.rating)
                            ? 'star-filled'
                            : 'star-empty'
                        }`}
                        fill={star <= (hoverRating || formData.rating) ? 'currentColor' : undefined}
                      />
                    </button>
                  ))}
                </div>

                <div className="rating-label">
                  {hoverRating === 1 && "Poor"}
                  {hoverRating === 2 && "Fair"}
                  {hoverRating === 3 && "Good"}
                  {hoverRating === 4 && "Very Good"}
                  {hoverRating === 5 && "Excellent"}
                  {!hoverRating && formData.rating > 0 && (
                    formData.rating === 1 ? "Poor" :
                    formData.rating === 2 ? "Fair" :
                    formData.rating === 3 ? "Good" :
                    formData.rating === 4 ? "Very Good" :
                    formData.rating === 5 ? "Excellent" : ""
                  )}
                </div>
              </div>

              {/* Comment Section */}
              <div className="comment-section">
                <label htmlFor="comment">
                  Additional Comments
                  <span className="optional-badge">(Optional)</span>
                </label>
                <textarea
                  id="comment"
                  rows={5}
                  placeholder="Share your thoughts, suggestions, or any specific feedback..."
                  value={formData.comment}
                  onChange={handleComment}
                />
                <div className="char-count">
                  {formData.comment.length} characters
                </div>
              </div>

              {/* Error Message */}
              {status.type === 'error' && (
                <div className="error-message">
                  <AlertCircle className="error-icon" size={20} />
                  <span>{status.message}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="submit-section">
                <button
                  type="submit"
                  disabled={isLoading || formData.rating === 0}
                  className="submit-button"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="loading-icon" size={20} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Submit Feedback
                    </>
                  )}
                </button>
                {formData.rating === 0 && (
                  <p className="submit-hint">
                    Please select a rating to submit
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Survey;
